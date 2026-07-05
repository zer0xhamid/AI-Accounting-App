import Database from 'better-sqlite3'
import { IPC } from '../../shared/ipc-channels'
import { GeminiService } from '../services/gemini.service'

export function registerAIHandlers(ipcMain: Electron.IpcMain, db: Database.Database): void {
  const gemini = new GeminiService(db)

  ipcMain.handle(IPC.AI_PARSE_TEXT, async (_e, text: string) => {
    return await gemini.parseText(text)
  })

  ipcMain.handle(IPC.AI_PARSE_IMAGE, async (_e, base64: string) => {
    return await gemini.parseImage(base64)
  })

  ipcMain.handle(IPC.AI_PARSE_AUDIO, async (_e, base64Audio: string) => {
    return await gemini.parseAudio(base64Audio)
  })

  ipcMain.handle(IPC.AI_CHAT, async (_e, question: string) => {
    return await gemini.chat(question)
  })

  ipcMain.handle(IPC.AI_TEST_KEY, async (_e, key: string) => {
    return await gemini.testApiKey(key)
  })

  ipcMain.handle(IPC.AI_DAILY_USAGE, () => {
    return gemini.getDailyUsage()
  })

  ipcMain.handle(IPC.AI_GENERATE_BOM, async (_e, productDescription: string) => {
    return await gemini.generateBomRecipe(productDescription)
  })
}
