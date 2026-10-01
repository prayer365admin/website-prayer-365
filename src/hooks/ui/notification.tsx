import { App } from 'antd'

type notificationProps = {
  type: 'success' | 'error'
  entity: string
  action: string
}

export const useMainNotification = () => {
  const { notification } = App.useApp()

  const showNotification = ({ type, entity, action }: notificationProps) => {
    const generalNotification = {
      success: {
        title: 'Success!',
        description: `Congratulations! ${entity.toLowerCase()} has been successfully ${action.toLowerCase()}!`,
      },
      error: {
        title: 'Error!',
        description: `Oops! Something went wrong with ${entity.toLowerCase()}. Unable to ${action.toLowerCase()} at this time. Please try again later or contact support if the issue persists`,
      },
    }

    return notification[type]({
      title: generalNotification[type].title,
      description: generalNotification[type].description,
    })
  }

  return showNotification
}
