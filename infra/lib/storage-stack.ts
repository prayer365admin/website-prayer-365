import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'
import type { EnvConfig } from '../config/types'

type Props = StackProps & { config: EnvConfig }

/**
 * Media storage component.
 *
 * - `storage.mode: 'existing'` (catatia): create nothing, publish the bucket name
 *   that the app already uses.
 * - `storage.mode: 'create'` (clients): a dedicated bucket per environment.
 *
 * Access posture is deliberately public-read for now (SPEC §10.4.1 / D13): the
 * mobile app renders media in an <Image> that cannot send an auth header, so
 * objects must be reachable by URL alone. Revert to per-purpose signed access
 * before production — see D13.
 */
export class StorageStack extends Stack {
  public readonly bucketName: string

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props)
    const { config } = props

    if (config.storage.mode === 'create') {
      const bucket = new Bucket(this, 'Media', {
        bucketName: `prayer365-${config.name}-media`,
        encryption: BucketEncryption.S3_MANAGED,
        versioned: config.removalPolicy === 'retain',
        // D13: temporary public read.
        publicReadAccess: true,
        blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
        cors: [
          {
            allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.HEAD],
            allowedOrigins: ['*'],
            allowedHeaders: ['*'],
            exposedHeaders: ['ETag'],
            maxAge: 3000,
          },
        ],
        lifecycleRules: [
          {
            id: 'abort-incomplete-uploads',
            abortIncompleteMultipartUploadAfter: Duration.days(3),
          },
          {
            // Unattached presigned uploads never get a MediaAsset row.
            id: 'expire-unattached-uploads',
            prefix: 'uploads/',
            expiration: Duration.days(30),
          },
        ],
        removalPolicy:
          config.removalPolicy === 'retain' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        autoDeleteObjects: config.removalPolicy !== 'retain',
      })
      this.bucketName = bucket.bucketName
    } else {
      this.bucketName = config.storage.bucketName
    }

    // SSM keeps the stacks independently deployable: no cross-stack exports, so
    // `cdk deploy <stack> --exclusively` works as long as the parameter exists.
    new StringParameter(this, 'BucketNameParam', {
      parameterName: `/prayer365/${config.name}/bucket-name`,
      stringValue: this.bucketName,
    })
    new StringParameter(this, 'BucketArnParam', {
      parameterName: `/prayer365/${config.name}/bucket-arn`,
      stringValue: `arn:aws:s3:::${this.bucketName}`,
    })

    new CfnOutput(this, 'BucketName', { value: this.bucketName })
  }
}
