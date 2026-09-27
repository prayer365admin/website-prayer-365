import { useMediaUpload } from '@/hooks/data/media-upload'
import { toCapitalized } from '@/utils/capitalized'
import { extensionChecker } from '@/utils/extension-checker'
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Col,
  Form,
  GetProp,
  Image,
  notification,
  Upload,
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
  upload: { url: string | null }
  setUpload: Dispatch<SetStateAction<{ url: string | null }>>
  onUploadData?: (url: string) => Promise<void>
  /** Entity context for the global upload API (SPEC §10.4). Pass when available. */
  churchId?: string
  purpose?: 'IMAGE' | 'VOICE_SAMPLE' | 'CONSENT_EVIDENCE'
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
  } = props

  const [fileList, setFileList] = useState<UploadProps['fileList']>([])
  const { loading: uploadLoading, onUpload } = useMediaUpload({ churchId, purpose })
  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess }) => {
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
        setUpload({ url: url })
        if (onSuccess) {
          onSuccess(url)
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
    if (initialData) {
      setUpload({ url: initialData })
    }
  }, [initialData, setUpload])

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
            <div className="text-center">
              {extensionChecker(upload.url) === 'IMAGE' && (
                <Image
                  src={upload.url}
                  alt="upload-image"
                  wrapperClassName="rounded-[20px]"
                  className={`rounded-[20px]`}
                  style={{ width: width, height: height, objectFit: 'cover' }}
                  preview={false}
                />
              )}
              {extensionChecker(upload.url) === 'VIDEO' && (
                <div className="mb-2 rounded-[20px]">
                  <ReactPlayer url={upload.url} playing loop muted={true} />
                </div>
              )}
              <div>
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    setUpload({ url: '' })
                  }}
                >
                  Remove {toCapitalized(extensionChecker(upload.url) || 'FILE')}
                </Button>
              </div>
            </div>
          )}
          {!upload.url && (
            <button
              type="button"
              className={`border border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50`}
              style={{ height: height, width: width }}
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
