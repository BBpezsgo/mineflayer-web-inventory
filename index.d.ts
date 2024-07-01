declare module 'mineflayer' {
    interface Bot {
        webInventory: {
            options: Options
            isRunning: boolean
            start?: () => Promise<void>
            stop?: () => Promise<void>
        }
    }
}

type Options = {
    webPath?: string
    path?: string
    express?: typeof import('express')
    app?: import('express').Express
    http?: ReturnType<typeof import('http').createServer>
    port?: number
    windowUpdateDebounceTime?: number
    debounceTime?: number
    io?: import('socket.io').Server
    startOnLoad?: boolean
}

type BotWindow = {
    id: null | number
    type: null | string
    slots: { [slot: number]: import('./utils').DetailedItem | null} 
    unsupported?: true
    realId?: number
    realType?: string | number
}

export default function(bot: import('mineflayer').Bot, options: Options = { }): any
