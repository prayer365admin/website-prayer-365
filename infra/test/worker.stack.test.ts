import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { DataStack } from '../lib/data-stack'
import { WorkerStack } from '../lib/worker-stack'
import { catatia } from '../config/environments/catatia'
import { clientExample } from '../config/environments/client-example'
import type { EnvConfig } from '../config/types'

const build = (config: EnvConfig) => {
  const app = new App()
  const stack = new WorkerStack(app, 'test-workers', {
    env: { account: config.account, region: config.region },
    config,
  })
  return Template.fromStack(stack)
}

const enabled = (config: EnvConfig): EnvConfig => ({
  ...config,
  workers: { ...config.workers, enabled: true },
})

const functions = (template: Template) =>
  Object.values(template.findResources('AWS::Lambda::Function')) as {
    Properties: {
      FunctionName: string
      Timeout: number
      MemorySize: number
      Environment: { Variables: Record<string, string> }
      ReservedConcurrentExecutions?: number
    }
  }[]

describe('WorkerStack', () => {
  it('creates a dispatcher and a consumer with the configured timeouts and log retention', () => {
    const template = build(enabled(catatia))
    const lambdas = functions(template)
    expect(lambdas).toHaveLength(2)

    const dispatcher = lambdas.find(
      (fn) => fn.Properties.FunctionName === `prayer365-${catatia.name}-dispatcher`,
    )
    const consumer = lambdas.find(
      (fn) => fn.Properties.FunctionName === `prayer365-${catatia.name}-consumer`,
    )

    expect(dispatcher?.Properties.Timeout).toBe(60)
    expect(consumer?.Properties.Timeout).toBe(catatia.workers.consumerTimeoutSeconds)
    expect(consumer?.Properties.MemorySize).toBe(catatia.workers.consumerMemoryMb)

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: catatia.logRetentionDays,
    })
  })

  it('subscribes the consumer to the queue with partial batch responses', () => {
    const template = build(enabled(catatia))

    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 5,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
      ScalingConfig: { MaximumConcurrency: 2 },
    })
  })

  it('schedules the dispatcher only when the worker component is enabled', () => {
    const on = build(enabled(catatia))
    on.resourceCountIs('AWS::Events::Rule', 1)

    // Explicitly disabled: catatia itself is enabled since it is deployed.
    const off = build({ ...catatia, workers: { ...catatia.workers, enabled: false } })
    off.resourceCountIs('AWS::Events::Rule', 0)
    // Disabled = throttled off, not deleted, so a re-enable is a config flip.
    off.hasResourceProperties('AWS::Lambda::Function', { ReservedConcurrentExecutions: 0 })
  })

  it('injects secrets as deploy-time references and never as plain values', () => {
    const template = build(enabled(catatia))
    const json = JSON.stringify(template.toJSON())

    expect(json).toContain(
      '{{resolve:secretsmanager:/prayer365/catatia/database-url:SecretString::}}',
    )
    expect(json).not.toContain('postgresql://')
    expect(json).not.toContain('AWS_ACCESS_KEY_ID')
    expect(json).not.toContain('AWS_SECRET_ACCESS_KEY')
  })

  it('alarms on a non-empty DLQ and on function errors', () => {
    const template = build(enabled(catatia))
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3)
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: `prayer365-${catatia.name}-alarms`,
    })
  })

  it('runs the Lambdas OUTSIDE a VPC for a public database', () => {
    const template = build(enabled(catatia))

    for (const fn of functions(template)) {
      expect(fn.Properties).not.toHaveProperty('VpcConfig')
    }
  })

  it('places the Lambdas in the private subnets when the data stack supplies a VPC', () => {
    const app = new App()
    const config = enabled(clientExample)
    const env = { account: config.account, region: config.region }
    const data = new DataStack(app, 'client-data', { env, config })
    const workers = new WorkerStack(app, 'client-workers', { env, config, vpc: data.vpc })

    const template = Template.fromStack(workers)
    template.hasResourceProperties('AWS::Lambda::Function', {
      VpcConfig: Match.objectLike({
        SubnetIds: Match.anyValue(),
        SecurityGroupIds: Match.anyValue(),
      }),
    })
    // No inbound rule: the Lambdas only need egress.
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'PRAYER worker Lambdas: egress only, no inbound',
    })
  })
})
