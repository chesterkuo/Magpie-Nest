import type { FileItem } from '@magpie/shared'

export function ImageGrid({ items }: { items: FileItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
      {items.map((item) => (
        <img
          key={item.id}
          src={item.thumbUrl}
          alt={item.name}
          className="w-full aspect-square object-cover cursor-pointer"
        />
      ))}
    </div>
  )
}
