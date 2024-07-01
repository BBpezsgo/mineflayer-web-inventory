declare module 'minecraft-assets' {
    export = function(mcVersion: string) {
        // Check exact version first
        let assets = getVersion(mcVersion)
        if (assets) { return assets }
        // If not found, resort to the last of major
        assets = getVersion(lastOfMajor[toMajor(mcVersion)])
        return assets
    }

    declare function getVersion(mcVersion: Version): Assets | null
      
    declare function toMajor(version: any): string
    declare function minor(version: any): number

    export type Assets = {
        blocks: { [name: string]: Data['blocksTextures'][0] }
        blocksArray: Data['blocksTextures']
        items: { [name: string]: Data['itemsTextures'][0] }
        itemsArray: Data['itemsTextures']
        textureContent: { [name: string]: Data['textureContent'][0] }
        textureContentArray: Data['textureContent']
        blocksStates: Data['blocksStates']
        blocksModels: Data['blocksModels']
        directory: string
        version: any
        findItemOrBlockByName: (name: string) => Data['itemsTextures'][0] | Data['blocksTextures'][0] | undefined
        getTexture: (name: string) => string | null
        getImageContent: (name: string) => string | null
    }

    type Data = {
        blocksTextures: Array<{
            name: string
            blockState: string
            model: string | null
            texture: string | null
        }>
        itemsTextures: Array<{
            name: string
            model: string | null
            texture: string | null
        }>
        textureContent: Array<{
            name: string
            texture: string | null
        }>
        blocksStates: {
            [blockName: string]: any
        }
        blocksModels: {
            [blockName: string]: {
                parent?: string
                textures?: {
                    [name: string]: string
                }
                display?: any
                elements?: Array<any>
            }
        }
    }

    type Version =
      '1.8.8' |
      '1.9' |
      '1.10' |
      '1.11.2' |
      '1.12' |
      '1.13' |
      '1.13.2' |
      '1.14.4' |
      '1.15.2' |
      '1.16.1' |
      '1.16.4' |
      '1.17.1' |
      '1.18.1' |
      '1.19.1' |
      '1.20.2'

    export const versions: Version
    declare const data: { [key in Version]: Data }
    declare const lastOfMajor: { [major: string]: Version }
}
