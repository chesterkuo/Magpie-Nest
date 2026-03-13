const DB_NAME = 'magpie-conversations'
const STORE_NAME = 'conversations'
const MAX_CONVERSATIONS = 50

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveConversation(id: string, messages: any[]) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put({ id, messages, updatedAt: new Date().toISOString() })
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject })
}

export async function getConversation(id: string): Promise<any | null> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function listConversations(): Promise<any[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      const results = req.result.sort((a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ).slice(0, MAX_CONVERSATIONS)
      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}
