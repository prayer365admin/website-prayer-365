import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
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
import { AccessKey, Effect, PolicyStatement, User } from 'aws-cdk-lib/aws-iam'
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds'
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses'
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
      description:
        'JSON credentials only, e.g. {"MAILGUN_USER","MAILGUN_PASSWORD"} — the provider comes from the worker env (MAIL_PROVIDER); SES needs no keys (the Lambda role and the Vercel IAM user hold the permission)',
    })
    // F12 notification workers: the device-token crypto key (shared with the web app)
    // and the FCM service account. Containers only — the deploy script seeds the values.
    new Secret(this, 'DeviceTokenKey', {
      secretName: `/prayer365/${config.name}/device-token-key`,
      description: 'base64 32-byte AES-256-GCM key shared with the web app (DEVICE_TOKEN_KEY)',
    })
    new Secret(this, 'FirebaseServiceAccount', {
      secretName: `/prayer365/${config.name}/firebase-service-account`,
      description: 'Firebase service-account JSON used by the notification worker (FCM)',
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
      // A public instance must sit in a PUBLIC subnet: RDS only assigns a public
      // address there (`publiclyAccessible` is inferred from the subnet type).
      const publicDb = config.database.publiclyAccessible
      this.database = new DatabaseInstance(this, 'Postgres', {
        engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_16 }),
        // Free tier: db.t4g.micro + 20 GB gp3, single-AZ, no standby.
        instanceType: new InstanceType(config.database.instanceType),
        allocatedStorage: config.database.storageGb,
        storageType: StorageType.GP3,
        databaseName: 'prayer365',
        vpc: this.vpc,
        vpcSubnets: {
          subnetType: publicDb ? SubnetType.PUBLIC : SubnetType.PRIVATE_WITH_EGRESS,
        },
        publiclyAccessible: publicDb,
        multiAz: false,
        storageEncrypted: true,
        backupRetention: Duration.days(config.database.backupRetentionDays),
        deletionProtection: config.removalPolicy === 'retain',
        removalPolicy:
          config.removalPolicy === 'retain' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      })

      /*
       * The construct's default security group has NO inbound rules, so a reach
       * rule is mandatory in both shapes. Public: the web app runs on Vercel with
       * no fixed egress IPs, so the only usable rule is the whole internet —
       * `sslmode=require` and the RDS-generated password are the guard (temporary
       * posture, same spirit as the public media bucket, D13).
       */
      if (publicDb) {
        this.database.connections.allowDefaultPortFrom(
          Peer.anyIpv4(),
          'Web app on Vercel + operator migrations (temporary, no fixed egress IPs)',
        )
      } else {
        this.database.connections.allowDefaultPortFrom(
          Peer.ipv4(this.vpc.vpcCidrBlock),
          'Lambdas in this VPC',
        )
      }

      new CfnOutput(this, 'DatabaseEndpoint', { value: this.database.dbInstanceEndpointAddress })
      new CfnOutput(this, 'DatabasePort', { value: this.database.dbInstanceEndpointPort })
      new CfnOutput(this, 'DatabaseInstanceIdentifier', {
        value: this.database.instanceIdentifier,
      })
    }

    /*
     * Transactional email (SES). The identity is per-region, so it lives beside
     * the rest of the environment's data. `create` makes a new domain identity and
     * emits the DKIM records the domain owner has to publish; `existing` adopts a
     * domain verified earlier (catatia.com) — CDK cannot read an imported
     * identity's DKIM tokens, so read those with
     * `aws sesv2 get-email-identity --email-identity <domain>`.
     */
    const email = config.email
    new StringParameter(this, 'SesDomainParam', {
      parameterName: `/prayer365/${config.name}/ses-domain`,
      stringValue: email.domain,
    })
    new CfnOutput(this, 'SesDomain', { value: email.domain })
    if (email.mailFromDomain) {
      new CfnOutput(this, 'SesMailFromDomain', { value: email.mailFromDomain })
    }

    if (email.mode === 'create') {
      const identity = new EmailIdentity(this, 'EmailIdentity', {
        identity: Identity.domain(email.domain),
        mailFromDomain: email.mailFromDomain,
      })
      const tokens: [string, string][] = [
        [identity.dkimDnsTokenName1, identity.dkimDnsTokenValue1],
        [identity.dkimDnsTokenName2, identity.dkimDnsTokenValue2],
        [identity.dkimDnsTokenName3, identity.dkimDnsTokenValue3],
      ]
      tokens.forEach(([name, value], index) => {
        new CfnOutput(this, `SesDkimTokenName${index + 1}`, { value: name })
        new CfnOutput(this, `SesDkimTokenValue${index + 1}`, { value: value })
      })
    } else {
      EmailIdentity.fromEmailIdentityName(this, 'EmailIdentity', email.domain)
    }

    /*
     * The web app runs on Vercel, outside this account, so it authenticates with a
     * static key pair — the same pattern the shared catatia account uses. Created
     * only for environments that own their resources (`storage.mode: 'create'`);
     * the pair lands in a secret container and is copied to Vercel by hand.
     */
    if (config.storage.mode === 'create') {
      const appUser = new User(this, 'AppUser', { userName: `prayer365-${config.name}-app` })
      appUser.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::prayer365-${config.name}-media`,
            `arn:aws:s3:::prayer365-${config.name}-media/*`,
          ],
        }),
      )
      appUser.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          // Scoped to the verified identity, so the key cannot send as another domain.
          resources: [`arn:aws:ses:${this.region}:${this.account}:identity/${email.domain}`],
        }),
      )

      const accessKey = new AccessKey(this, 'AppUserAccessKey', { user: appUser })
      new Secret(this, 'AppCredentials', {
        secretName: `/prayer365/${config.name}/app-credentials`,
        description: 'AWS key pair for the Vercel deployment: media bucket + SES sending',
        secretObjectValue: {
          AWS_ACCESS_KEY_ID: SecretValue.unsafePlainText(accessKey.accessKeyId),
          AWS_SECRET_ACCESS_KEY: accessKey.secretAccessKey,
        },
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
