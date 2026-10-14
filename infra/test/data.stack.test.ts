import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { DataStack } from '../lib/data-stack'
import { catatia } from '../config/environments/catatia'
import { clientExample } from '../config/environments/client-example'
import type { EnvConfig } from '../config/types'

const build = (config: EnvConfig) => {
  const app = new App()
  const stack = new DataStack(app, 'test-data', {
    env: { account: config.account, region: config.region },
    config,
  })
  return Template.fromStack(stack)
}

describe('DataStack', () => {
  it('external mode creates the queue pair and secret containers, but no RDS', () => {
    const template = build(catatia)

    template.resourceCountIs('AWS::RDS::DBInstance', 0)
    template.resourceCountIs('AWS::SecretsManager::Secret', 5)
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: `prayer365-${catatia.name}-jobs`,
      VisibilityTimeout: catatia.workers.leaseSeconds,
    })
  })

  it('the jobs queue redrives to the DLQ after 5 receives', () => {
    const template = build(catatia)
    const redrive = template.findResources('AWS::SQS::Queue', {
      Properties: { QueueName: `prayer365-${catatia.name}-jobs` },
    })
    const queue = Object.values(redrive)[0] as {
      Properties: { RedrivePolicy: { maxReceiveCount: number } }
    }
    expect(queue.Properties.RedrivePolicy.maxReceiveCount).toBe(5)
  })

  it('create mode adds a private, encrypted, single-AZ RDS instance and a NAT instance', () => {
    const template = build(clientExample)

    template.hasResourceProperties('AWS::RDS::DBInstance', {
      PubliclyAccessible: false,
      StorageEncrypted: true,
      MultiAZ: false,
      AllocatedStorage: '20',
      DeletionProtection: true,
    })
    // NAT instance, not a NAT gateway.
    template.hasResourceProperties('AWS::EC2::Instance', { SourceDestCheck: false })
    template.resourceCountIs('AWS::EC2::NatGateway', 0)
  })

  it('never renders a connection string or provider key into the template', () => {
    for (const config of [catatia, clientExample]) {
      const json = JSON.stringify(build(config).toJSON())
      expect(json).not.toContain('postgresql://')
      expect(json).not.toContain('sk_live')
      expect(json).not.toContain('sk_test')
    }
  })

  it('gives the NAT instance a fixed egress IP when the database allow-lists sources', () => {
    const template = build(clientExample)

    template.resourceCountIs('AWS::EC2::EIP', 1)
    template.resourceCountIs('AWS::EC2::EIPAssociation', 1)
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/prayer365/${clientExample.name}/nat-egress-ip`,
    })
  })

  it('refuses to create a private database when the Lambdas would run outside a VPC', () => {
    const mismatched: EnvConfig = { ...clientExample, network: { mode: 'public' } }
    expect(() => build(mismatched)).toThrowError(/requires network.mode 'vpc'/)
  })

  it('external mode skips the VPC entirely when the database is public', () => {
    const template = build(catatia)

    template.resourceCountIs('AWS::EC2::VPC', 0)
    template.resourceCountIs('AWS::EC2::Instance', 0)
    template.resourceCountIs('AWS::EC2::EIP', 0)
  })
})
