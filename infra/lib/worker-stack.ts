import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { SecurityGroup, SubnetType, type Vpc } from 'aws-cdk-lib/aws-ec2'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { Architecture, Runtime, type IFunction } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Secret, type ISecret } from 'aws-cdk-lib/aws-secretsmanager'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { resolve } from 'node:path'
import type { Construct } from 'constructs'
import type { EnvConfig } from '../config/types'

type Props = StackProps & {
  config: EnvConfig
  /**
   * Supplied by the data stack when the environment runs in `network.mode: 'vpc'`.
   * Absent for public databases: the Lambdas then run outside a VPC, which is
   * the cheapest option and works with any publicly reachable database.
   */
  vpc?: Vpc
}

/** Secret name suffix -> Lambda environment variable. */
const SECRET_ENV: Record<string, string> = {
  DATABASE_URL: 'database-url',
  ELEVENLABS_API_KEY: 'elevenlabs-api-key',
  STRIPE_SECRET_KEY: 'stripe-secret-key',
  // payment.sync talks to Stripe; the webhook endpoint itself stays on Vercel.
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-secret',
  MAIL_CREDENTIALS: 'mail-credentials',
}

/**
 * Worker component: dispatcher + consumer Lambdas, the SQS event source, the
 * dispatch schedule, log groups and alarms.
 *
 * Deployable on its own (`bun run deploy:workers`), which is why every shared
 * value is read from SSM instead of a cross-stack reference.
 *
 * No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY anywhere: the execution roles
 * provide credentials (risk I-R1 in the plan).
 */
export class WorkerStack extends Stack {
  public readonly dispatcher: IFunction
  public readonly consumer: IFunction

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props)
    const { config, vpc } = props
    const repoRoot = resolve(__dirname, '../..')

    /*
     * Network placement. Public databases (DigitalOcean, Neon, Supabase, an
     * RDS with a public endpoint) need nothing: the Lambda runs outside a VPC and
     * connects over the internet with TLS, exactly like a local `bun run worker:*`.
     * A private database requires the VPC, and egress for ElevenLabs/Stripe/SMTP
     * comes from the NAT instance. The application code does not change either
     * way — only the `DATABASE_URL` secret and this placement do.
     */
    const placement = vpc
      ? {
          vpc,
          vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
          securityGroups: [
            new SecurityGroup(this, 'LambdaSecurityGroup', {
              vpc,
              description: 'PRAYER worker Lambdas: egress only, no inbound',
              allowAllOutbound: true,
            }),
          ],
        }
      : {}

    const parameter = (name: string) =>
      StringParameter.valueForStringParameter(this, `/prayer365/${config.name}/${name}`)
    const secretName = (suffix: string) => `/prayer365/${config.name}/${suffix}`

    const bucketName = parameter('bucket-name')
    const jobsQueueUrl = parameter('jobs-queue-url')
    const jobsQueueArn = parameter('jobs-queue-arn')
    const jobsDlqArn = parameter('jobs-dlq-arn')

    const jobsQueue = Queue.fromQueueAttributes(this, 'JobsQueue', {
      queueArn: jobsQueueArn,
      queueUrl: jobsQueueUrl,
    })
    const jobsDlq = Queue.fromQueueAttributes(this, 'JobsDlq', { queueArn: jobsDlqArn })
    const mediaBucket = Bucket.fromBucketName(this, 'MediaBucket', bucketName)

    const secrets: Record<string, ISecret> = {}
    for (const [envKey, suffix] of Object.entries(SECRET_ENV)) {
      secrets[envKey] = Secret.fromSecretNameV2(this, `Secret${envKey}`, secretName(suffix))
    }

    /*
     * CloudFormation dynamic reference, resolved at deploy time, so no secret
     * VALUE ever appears in the template. NodejsFunction has no `secrets` prop
     * (unlike Function), and the secret NAME is used on purpose: an ARN imported
     * by name is partial (no 6-character suffix) and dynamic references expect
     * either the complete ARN or the name.
     */
    const secretEnv = (envKey: string) =>
      `{{resolve:secretsmanager:${secretName(SECRET_ENV[envKey])}:SecretString::}}`

    const commonEnvironment = {
      APP_ENV: config.name,
      // AWS_REGION is set by the Lambda runtime itself (it is a reserved
      // variable) and is what the S3/SQS clients read.
      AWS_BUCKET_NAME: bucketName,
      NODE_OPTIONS: '--enable-source-maps',
      // ElevenLabs work is refused unless this is exactly 'true'.
      ELEVENLABS_ENABLED: 'true',
      MAIL_PROVIDER: 'mailgun',
      MAIL_CREDENTIALS: secretEnv('MAIL_CREDENTIALS'),
      // Per-email pacing for SES sandbox 1 msg/s; values larger than the
      // consumer timeout inflate consumerTimeoutSeconds requirements.
      MAIL_RATE_LIMIT_MS: '1000',
      VOICE_SAMPLE_MAX_FILES: '3',
    }

    // CloudWatch only accepts the values in the RetentionDays enum.
    const supportedRetention = Object.values(RetentionDays).filter(
      (value): value is RetentionDays => typeof value === 'number',
    )
    const retentionFor = (days: number): RetentionDays => {
      if (!supportedRetention.includes(days)) {
        throw new Error(
          `logRetentionDays ${days} is not a CloudWatch retention value; use one of ${supportedRetention.join(', ')}`,
        )
      }
      return days as RetentionDays
    }

    const logGroup = (name: string) =>
      new LogGroup(this, name, {
        logGroupName: `/aws/lambda/prayer365-${config.name}-${name}`,
        retention: retentionFor(config.logRetentionDays),
      })

    this.dispatcher = new NodejsFunction(this, 'Dispatcher', {
      functionName: `prayer365-${config.name}-dispatcher`,
      entry: resolve(repoRoot, 'src/lambda/dispatcher.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(60),
      memorySize: 512,
      projectRoot: repoRoot,
      depsLockFilePath: resolve(repoRoot, 'bun.lock'),
      logGroup: logGroup('dispatcher'),
      ...placement,
      environment: {
        ...commonEnvironment,
        DATABASE_URL: secretEnv('DATABASE_URL'),
        JOBS_QUEUE_URL: jobsQueueUrl,
        JOB_CLAIM_LIMIT: String(config.workers.claimLimit),
        JOB_LEASE_SECONDS: String(config.workers.leaseSeconds),
      },
      // 0 = throttled off, used while the worker component is disabled.
      ...(config.workers.enabled ? {} : { reservedConcurrentExecutions: 0 }),
    })
    jobsQueue.grantSendMessages(this.dispatcher)
    secrets.DATABASE_URL.grantRead(this.dispatcher)

    this.consumer = new NodejsFunction(this, 'Consumer', {
      functionName: `prayer365-${config.name}-consumer`,
      entry: resolve(repoRoot, 'src/lambda/consumer.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(config.workers.consumerTimeoutSeconds),
      memorySize: config.workers.consumerMemoryMb,
      projectRoot: repoRoot,
      depsLockFilePath: resolve(repoRoot, 'bun.lock'),
      logGroup: logGroup('consumer'),
      ...placement,
      environment: {
        ...commonEnvironment,
        ...Object.fromEntries(Object.keys(SECRET_ENV).map((key) => [key, secretEnv(key)])),
      },
    })
    this.consumer.addEventSource(
      new SqsEventSource(jobsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
        maxConcurrency: 2,
      }),
    )
    jobsQueue.grantConsumeMessages(this.consumer)
    jobsDlq.grantSendMessages(this.consumer)
    mediaBucket.grantReadWrite(this.consumer)
    for (const secret of Object.values(secrets)) secret.grantRead(this.consumer)

    if (config.workers.enabled && config.workers.dispatchSchedule !== 'off') {
      new Rule(this, 'DispatchSchedule', {
        schedule: Schedule.expression(config.workers.dispatchSchedule),
        targets: [new LambdaFunction(this.dispatcher)],
      })
    }

    const alarms = new Topic(this, 'Alarms', {
      topicName: `prayer365-${config.name}-alarms`,
    })
    if (config.alarmEmail) alarms.addSubscription(new EmailSubscription(config.alarmEmail))

    new Alarm(this, 'JobsDlqNotEmpty', {
      metric: jobsDlq.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Dead-lettered jobs need a human: inspect, fix, then redrive.',
    }).addAlarmAction(new SnsAction(alarms))

    new Alarm(this, 'DispatcherErrors', {
      metric: this.dispatcher.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Dispatcher failed to claim or forward jobs.',
    }).addAlarmAction(new SnsAction(alarms))

    new Alarm(this, 'ConsumerErrors', {
      metric: this.consumer.metricErrors({ period: Duration.minutes(5) }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Consumer is failing jobs; check the DLQ and logs.',
    }).addAlarmAction(new SnsAction(alarms))

    new CfnOutput(this, 'DispatcherFunctionName', { value: this.dispatcher.functionName })
    new CfnOutput(this, 'ConsumerFunctionName', { value: this.consumer.functionName })
    new CfnOutput(this, 'AlarmsTopicArn', { value: alarms.topicArn })
  }
}
