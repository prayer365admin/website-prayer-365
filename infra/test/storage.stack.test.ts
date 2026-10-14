import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { StorageStack } from '../lib/storage-stack'
import { catatia } from '../config/environments/catatia'
import { clientExample } from '../config/environments/client-example'
import type { EnvConfig } from '../config/types'

const build = (config: EnvConfig) => {
  const app = new App()
  const stack = new StorageStack(app, 'test-storage', {
    env: { account: config.account, region: config.region },
    config,
  })
  return Template.fromStack(stack)
}

describe('StorageStack', () => {
  it('create mode makes a dedicated public-read bucket with lifecycle rules', () => {
    const template = build(clientExample)
    const buckets = template.findResources('AWS::S3::Bucket')
    const entries = Object.values(buckets) as { Properties: Record<string, unknown> }[]
    expect(entries).toHaveLength(1)
    const props = entries[0].Properties as {
      BucketName: string
      PublicAccessBlockConfiguration: Record<string, boolean | undefined>
      LifecycleConfiguration: { Rules: { Id: string }[] }
    }

    expect(props.BucketName).toBe(`prayer365-${clientExample.name}-media`)
    expect(props.PublicAccessBlockConfiguration.BlockPublicAcls).toBe(true)
    // Deliberately NOT blocking the bucket policy: D13 needs public reads.
    expect(props.PublicAccessBlockConfiguration.BlockPublicPolicy).toBeUndefined()
    expect(props.LifecycleConfiguration.Rules.map((rule) => rule.Id)).toEqual([
      'abort-incomplete-uploads',
      'expire-unattached-uploads',
    ])
    // The public-read policy that makes objects reachable by URL alone.
    template.resourceCountIs('AWS::S3::BucketPolicy', 1)
  })

  it('existing mode creates no bucket and publishes the existing name', () => {
    const template = build(catatia)

    template.resourceCountIs('AWS::S3::Bucket', 0)
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/prayer365/${catatia.name}/bucket-name`,
      Value: 'bucket-catatia',
    })
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/prayer365/${catatia.name}/bucket-arn`,
      Value: 'arn:aws:s3:::bucket-catatia',
    })
  })
})
