import { useTranslation } from 'react-i18next'
import { Spinner } from './ui/Spinner'

export function ThinkingIndicator({ tool }: { tool: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex items-center gap-2 text-[#6E6E73] text-sm py-1">
      <Spinner className="w-4 h-4" />
      <span>{tool === 'thinking' ? t('chat.thinking') : t('chat.usingTool', { tool })}</span>
    </div>
  )
}
