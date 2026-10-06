import { useMediaUpload } from '@/hooks/data/media-upload'
import { toCapitalized } from '@/utils/capitalized'
import { extensionChecker } from '@/utils/extension-checker'
import axios from 'axios'
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Col,
  Form,
  GetProp,
  Image,
  Upload,
  App,
  Skeleton,
  UploadFile,
  UploadProps,
} from 'antd'
import { Rule } from 'antd/es/form'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import ReactPlayer from 'react-player'
import s from './index.module.scss'

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0]

export default function UploadBox(props: {
  formName?: string | number | (string | number)[]
  label?: string
  initialData?: string | null
  width?: string
  height?: string
  rules?: Rule[]
  upload: { url: string | null; assetId?: string | null; file?: File | null }
  setUpload: Dispatch<
    SetStateAction<{ url: string | null; assetId?: string | null; file?: File | null }>
  >
  onUploadData?: (url: string) => Promise<void>
  /** Entity context for the global upload API (SPEC §10.4). Pass when available. */
  churchId?: string
  purpose?: 'IMAGE' | 'VOICE_SAMPLE' | 'CONSENT_EVIDENCE'
  disabled?: boolean
  deferUpload?: boolean
}) {
  const {
    formName = 'file',
    initialData = '',
    label,
    width = '200px',
    height = '200px',
    rules = [],
    upload,
    setUpload,
    onUploadData,
    churchId = '',
    purpose = 'IMAGE',
    disabled = false,
    deferUpload = false,
  } = props
  const form = Form.useFormInstance()
  const { notification } = App.useApp()
  const [fileList, setFileList] = useState<UploadProps['fileList']>([])
  const { loading: uploadLoading, onUpload } = useMediaUpload({ churchId, purpose })
  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess }) => {
    if (deferUpload) {
      const localFile = file as FileType
      const localUrl = URL.createObjectURL(localFile)
      setUpload({ url: localUrl, assetId: null, file: localFile })
      onSuccess?.('deferred')
      return
    }
    if (!churchId) {
      notification.error({
        message: 'Upload Failed',
        description: 'A church context is required to upload; pass churchId to UploadBox.',
      })
      return
    }
    const result = await onUpload(file as FileType)
    if (result) {
      const url = result.url
      if (url) {
        setUpload({ url: url, assetId: result.assetId, file: null })
        if (onSuccess) {
          onSuccess(result.assetId)
        }

        if (onUploadData) {
          await onUploadData(url)
        }
      }
    }
  }

  const getUploadValue = ({
    file,
    fileList,
  }: {
    file: UploadFile<File>
    fileList: UploadProps['fileList']
    status?: string
    response: string
  }) => {
    setFileList(fileList as UploadProps['fileList'])
    return file.response
  }
  useEffect(() => {
    if (initialData && !upload.url) {
      setUpload({ url: initialData })
    }
  }, [initialData, upload.url, setUpload])

  const [presignedUrl, setPresignedUrl] = useState<string | null>(null)
  const [fetchingUrl, setFetchingUrl] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchUrl = async () => {
      if (!upload.url) {
        setPresignedUrl(null)
        return
      }
      if (!upload.url.includes('/api/v1/uploads/')) {
        setPresignedUrl(upload.url)
        return
      }
      setFetchingUrl(true)
      try {
        const res = await axios.get(upload.url)
        if (isMounted && res.data?.result?.url) {
          setPresignedUrl(res.data.result.url)
        }
      } catch (_e) {
        // Suppress error
      } finally {
        if (isMounted) setFetchingUrl(false)
      }
    }
    fetchUrl()
    return () => {
      isMounted = false
    }
  }, [upload.url])

  return (
    <Col className="flex relative w-full">
      <Form.Item
        name={formName}
        getValueFromEvent={getUploadValue}
        label={label}
        rules={rules}
        className="w-full"
      >
        <Upload
          className={`${s.upload}`}
          style={{ width: width, height: height }}
          name="file"
          showUploadList={false}
          disabled={disabled}
          customRequest={handleUpload}
          fileList={fileList}
          onChange={({ fileList, file }) => {
            getUploadValue({
              file: file,
              fileList: fileList,
              status: file.status,
              response: file.response,
            })
          }}
          {...props}
        >
          {upload.url && (
            <div
              className="flex flex-col items-center justify-center gap-2"
              style={{ width: width }}
            >
              {fetchingUrl ? (
                <Skeleton.Image
                  active
                  style={{ width: width, height: height }}
                  className={`rounded-[20px]`}
                />
              ) : (purpose === 'IMAGE' || extensionChecker(upload.url) === 'IMAGE') &&
                presignedUrl ? (
                <Image
                  src={presignedUrl}
                  alt="upload-image"
                  className={`rounded-[20px]`}
                  style={{ width: width, height: height, objectFit: 'cover' }}
                  preview={false}
                />
              ) : extensionChecker(upload.url) === 'VIDEO' && presignedUrl ? (
                <div className="mb-2 rounded-[20px]">
                  <ReactPlayer src={presignedUrl} playing loop muted />
                </div>
              ) : null}
              <div>
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    setUpload({ url: '', assetId: null })
                    if (formName && form) {
                      form.setFieldValue(formName, undefined)
                    }
                  }}
                >
                  Remove{' '}
                  {toCapitalized(
                    purpose === 'IMAGE' ? 'IMAGE' : extensionChecker(upload.url) || 'FILE',
                  )}
                </Button>
              </div>
            </div>
          )}
          {!upload.url && (
            <button
              type="button"
              className={`border border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50`}
              style={{ height: height, width: width }}
              disabled={disabled}
            >
              {uploadLoading ? <LoadingOutlined /> : <PlusOutlined />}
              <div style={{ marginTop: 8 }}>Upload</div>
            </button>
          )}
        </Upload>
      </Form.Item>
    </Col>
  )
}
