import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { DataStack } from '../lib/data-stack'
import { catatia } from '../config/environments/catatia'
import { clientExample } from '../config/environments/client-example'
import { prayer365 } from '../config/environments/prayer-365'
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
    template.resourceCountIs('AWS::SecretsManager::Secret', 7)
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: `prayer365-${catatia.name}-jobs`,
      VisibilityTimeout: catatia.workers.leaseSeconds,
    })
  })

  it('creates the two notification secret containers the worker stack references', () => {
    const template = build(catatia)

    for (const suffix of ['device-token-key', 'firebase-service-account']) {
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: `/prayer365/${catatia.name}/${suffix}`,
      })
    }
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

  it('creates a domain identity for a new client and adopts catatia existing one', () => {
    // catatia adopts the domain verified in that account: no new resource.
    build(catatia).resourceCountIs('AWS::SES::EmailIdentity', 0)

    const template = build(prayer365)
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: 'prayer365.eu',
      MailFromAttributes: { MailFromDomain: 'mail.prayer365.eu' },
    })
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/prayer365/${prayer365.name}/ses-domain`,
    })
  })

  it('creates an app user with bucket and SES access when the environment owns its resources', () => {
    const template = build(prayer365)

    template.hasResourceProperties('AWS::IAM::User', { UserName: 'prayer365-prayer-365-app' })
    template.resourceCountIs('AWS::IAM::AccessKey', 1)
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: `/prayer365/${prayer365.name}/app-credentials`,
    })

    // catatia reuses the shared bucket and its existing IAM user: nothing new.
    build(catatia).resourceCountIs('AWS::IAM::User', 0)
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

  it('a publicly accessible database opens 5432 to the internet for the Vercel web app', () => {
    const template = build(prayer365)

    expect(prayer365.database).toMatchObject({ mode: 'create', publiclyAccessible: true })
    template.hasResourceProperties('AWS::RDS::DBInstance', { PubliclyAccessible: true })
    // The port renders as `Fn::GetAtt <db>.Endpoint.Port`, so the rule is asserted
    // on the CIDR/protocol only — the engine supplies 5432.
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      IpProtocol: 'tcp',
      CidrIp: '0.0.0.0/0',
    })
  })

  it('a private database is never opened to the internet', () => {
    const ingress = build(clientExample).findResources('AWS::EC2::SecurityGroupIngress')

    expect(JSON.stringify(ingress)).not.toContain('0.0.0.0/0')
  })
})
