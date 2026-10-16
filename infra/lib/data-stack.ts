import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import {
  CfnEIP,
  CfnEIPAssociation,
  InstanceType,
  NatProvider,
  NatTrafficDirection,
  Peer,
  Port,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'
import type { EnvConfig } from '../config/types'

type Props = StackProps & { config: EnvConfig }

/**
 * Data component: the job queue + secret containers, and (client environments
 * only) an RDS PostgreSQL instance.
 *
 * Secret *containers* are created here; the values are seeded by hand with
 * `aws secretsmanager put-secret-value` (see docs/admin/INFRA-DEPLOY.md). A
 * secret value must never reach git, CDK context, or the synthesized template.
 */
export class DataStack extends Stack {
  public readonly jobsQueue: Queue
  public readonly jobsDlq: Queue
  public readonly databaseUrlSecret: Secret
  public readonly vpc?: Vpc
  public readonly database?: DatabaseInstance

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props)
    const { config } = props

    this.jobsDlq = new Queue(this, 'JobsDlq', {
      queueName: `prayer365-${config.name}-jobs-dlq`,
      retentionPeriod: Duration.days(14),
    })

    this.jobsQueue = new Queue(this, 'Jobs', {
      queueName: `prayer365-${config.name}-jobs`,
      // SQS must not hand a message to a second consumer while the job is still
      // running: keep it equal to the outbox lease / Lambda timeout.
      visibilityTimeout: Duration.seconds(config.workers.leaseSeconds),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: { queue: this.jobsDlq, maxReceiveCount: 5 },
    })

    this.databaseUrlSecret = new Secret(this, 'DatabaseUrl', {
      secretName: `/prayer365/${config.name}/database-url`,
      description: `Prisma connection string used by the ${config.name} web app and workers`,
    })
    new Secret(this, 'ElevenLabsApiKey', {
      secretName: `/prayer365/${config.name}/elevenlabs-api-key`,
    })
    new Secret(this, 'StripeSecretKey', {
      secretName: `/prayer365/${config.name}/stripe-secret-key`,
    })
    new Secret(this, 'StripeWebhookSecret', {
      secretName: `/prayer365/${config.name}/stripe-webhook-secret`,
    })
    new Secret(this, 'MailCredentials', {
      secretName: `/prayer365/${config.name}/mail-credentials`,
      description: 'JSON: {"MAIL_PROVIDER","MAIL_FROM","MAILGUN_USER","MAILGUN_PASSWORD"}',
    })

    if (config.database.mode === 'create' && config.network.mode !== 'vpc') {
      throw new Error(
        `Environment "${config.name}": database.mode 'create' requires network.mode 'vpc' — a private RDS instance is not reachable from a Lambda running outside the VPC.`,
      )
    }

    if (config.network.mode === 'vpc') {
      // NAT *instance* (not a NAT gateway): the Lambdas in the VPC need internet
      // egress for ElevenLabs/Stripe/SMTP, and a t4g.nano costs ~$4/mo against
      // ~$32/mo for a gateway. The same instance doubles as the SSM bastion used
      // to run migrations (see the deploy doc).
      const natProvider = NatProvider.instanceV2({
        instanceType: new InstanceType(config.network.natInstanceType),
        defaultAllowedTraffic: NatTrafficDirection.OUTBOUND_ONLY,
      })
      this.vpc = new Vpc(this, 'Vpc', {
        maxAzs: 2,
        natGatewayProvider: natProvider,
        natGateways: 1,
      })
      // The private subnets (and therefore the Lambdas) may route egress through it.
      natProvider.connections.allowFrom(Peer.ipv4(this.vpc.vpcCidrBlock), Port.allTraffic())

      if (config.network.staticEgressIp) {
        // One fixed egress IP the database firewall can allow-list.
        const eip = new CfnEIP(this, 'NatEgressIp')
        for (const gateway of natProvider.gatewayInstances) {
          new CfnEIPAssociation(this, `NatEgressIpAssociation${gateway.node.id}`, {
            allocationId: eip.attrAllocationId,
            instanceId: gateway.instanceId,
          })
        }
        new StringParameter(this, 'NatEgressIpParam', {
          parameterName: `/prayer365/${config.name}/nat-egress-ip`,
          stringValue: eip.ref,
        })
        new CfnOutput(this, 'NatEgressIpOutput', { value: eip.ref })
      }
    }

    if (config.database.mode === 'create' && this.vpc) {
      this.database = new DatabaseInstance(this, 'Postgres', {
        engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_16 }),
        // Free tier: db.t4g.micro + 20 GB gp3, single-AZ, no standby.
        instanceType: new InstanceType(config.database.instanceType),
        allocatedStorage: config.database.storageGb,
        storageType: StorageType.GP3,
        databaseName: 'prayer365',
        vpc: this.vpc,
        vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        publiclyAccessible: false,
        multiAz: false,
        storageEncrypted: true,
        backupRetention: Duration.days(config.database.backupRetentionDays),
        deletionProtection: config.removalPolicy === 'retain',
        removalPolicy:
          config.removalPolicy === 'retain' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      })

      new CfnOutput(this, 'DatabaseEndpoint', { value: this.database.dbInstanceEndpointAddress })
      new CfnOutput(this, 'DatabasePort', { value: this.database.dbInstanceEndpointPort })
      new CfnOutput(this, 'DatabaseInstanceIdentifier', {
        value: this.database.instanceIdentifier,
      })
    }

    new StringParameter(this, 'JobsQueueUrlParam', {
      parameterName: `/prayer365/${config.name}/jobs-queue-url`,
      stringValue: this.jobsQueue.queueUrl,
    })
    new StringParameter(this, 'JobsQueueArnParam', {
      parameterName: `/prayer365/${config.name}/jobs-queue-arn`,
      stringValue: this.jobsQueue.queueArn,
    })
    new StringParameter(this, 'JobsDlqArnParam', {
      parameterName: `/prayer365/${config.name}/jobs-dlq-arn`,
      stringValue: this.jobsDlq.queueArn,
    })

    new CfnOutput(this, 'JobsQueueUrl', { value: this.jobsQueue.queueUrl })
    new CfnOutput(this, 'JobsDlqUrl', { value: this.jobsDlq.queueUrl })
  }
}
