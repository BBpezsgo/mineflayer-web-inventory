const path = require('path')
const fs = require('fs')

const resourcePack = require('../Minecraft-Resource-Pack-Converter')

const rawMcData = require('minecraft-data')
const { PNG } = require('pngjs')
const { ResourcePackZip } = require('../Minecraft-Resource-Pack-Converter/src/pack')

/**
 * @type {{ [name: string]: string[] }}
 */
const windowNames = {
  'inventory': ['minecraft:inventory'],
  'chest': ['minecraft:generic_9x3', 'minecraft:chest'],
  'crafting-table': ['minecraft:crafting', 'minecraft:crafting_table'],
  'furnace': ['minecraft:furnace'],
  'large-chest': ['minecraft:generic_9x6', 'minecraft:chest']
}

/** @type {ResourcePackZip | null} */
let defaultResourcePack = null

ResourcePackZip.read('C:\\Users\\bazsi\\AppData\\Roaming\\.tlauncher\\legacy\\Minecraft\\game\\versions\\Fabric 1.20.4\\Fabric 1.20.4.jar')
  .then(v => { defaultResourcePack = v })
  .catch(console.error)

// This is just to simulate a unsuported window on the tests
let failStreak = []
/**
 * @param {any[]} newFailStreak
 */
function setFailStreak (newFailStreak) {
  failStreak = newFailStreak
}

/**
 * @param {import('prismarine-windows').Window<unknown>} window
 */
function getWindowName (window) {
  if (failStreak.shift()) return null
  if (typeof window.type === 'number') return null

  // Until version 1.13 (included), chest and large chest had both the type 'minecraft:chest'
  // We determine which it is by it's number of slots
  if (window.type === 'minecraft:chest') {
    const slotCount = Object.keys(window.slots).length
    if (slotCount === 63) {
      return 'chest'
    } else {
      return 'large-chest'
    }
  }

  if (Object.keys(windowNames).includes(window.type)) return window.type
  return Object.keys(windowNames)[
    // @ts-ignore
    Object.values(windowNames).findIndex((e) => e.includes(window.type))
  ]
}

/**
 * @exports
 * @typedef {import('prismarine-item').Item & {
 *   texture?: string;
 *   durabilityLeft?: number;
 * }} DetailedItem
 */

/**
 * @param {import('minecraft-data').IndexedData | import('minecraft-assets').Assets} mcData
 * @param {import('minecraft-assets').Assets} mcAssets
 * @param {DetailedItem} item
 * @returns {DetailedItem}
 */
function addItemData(mcData, mcAssets, item) {
  if (!item) return item

  if (!item.texture && defaultResourcePack) {
    const modelPath = defaultResourcePack.namespaces['minecraft'].getModels('item')?.[item.name]
    if (modelPath) {
      const data = resourcePack.utils.renderModel(modelPath, defaultResourcePack, 32, 32)
      if (data) {
        const png = new PNG({
            width: data.width,
            height: data.height,
            filterType: -1,
        })
        // @ts-ignore
        png.data = data.data
        // @ts-ignore
        png.pack()
        const chunks = [ ]
        // @ts-ignore
        png.on('data', function (/** @type {any} */ chunk) { chunks.push(chunk) })
        // @ts-ignore
        png.on('end', function () {
          const result = Buffer.concat(chunks)
          item.texture = `data:image/png;base64,${result.toString('base64')}`
        })
      }
    }
  }

  if (!mcData) { return item }

  try {
    const blockModels = JSON.parse(fs.readFileSync(path.join(mcAssets.directory, 'blocks_models.json'), 'utf8'))

    if (mcData.version['<=']('1.12.2')) {
      // Fixes the name
      const itemVariations = mcData.itemsByName[item.name]?.variations ?? mcData.blocksByName[item.name]?.variations
      if (itemVariations) { item.displayName = itemVariations.find(variation => variation.metadata === item.metadata)?.displayName ?? item.displayName }

      // Tries to fix the texture
      // @ts-ignore
      let minecraftName = rawMcData.legacy.pc.items[item.type + ':' + item.metadata]?.substr('minecraft:'.length)

      if (minecraftName) {
        if (minecraftName.includes('[')) minecraftName = minecraftName.substr(0, minecraftName.indexOf['['] - 1)

        if (blockModels[minecraftName]) {
          const assetName = Object.values(blockModels[minecraftName].textures)[0]

          try {
            const textureBase64 = fs
              .readFileSync(path.join(mcAssets.directory, assetName + '.png'))
              .toString('base64')
            item.texture = 'data:image/png;base64,' + textureBase64
          } catch (err) {
            // It wasn't found. This happens with pistons for example
          }
        }
      }
    }
  } catch (err) {
    console.log('mineflayer-web-inventory error. trying to continue')
    console.log(err)
  } finally {
    if (!item.texture && mcAssets.textureContent[item.name]) item.texture = mcAssets.textureContent[item.name].texture
  }

  // Add durability left
  let itemMaxDurability
  if ((itemMaxDurability = mcData.itemsByName[item.name]?.maxDurability) && item.durabilityUsed != null) {
    item.durabilityLeft = (itemMaxDurability - item.durabilityUsed) / itemMaxDurability
  }

  return item
}

module.exports = { getWindowName, setFailStreak, addItemData }
