<script>
  import { throttle } from "lodash";
  import { onMount } from "svelte";

  import { receiveWindow, updateWindow } from "./updateWindow";

  const drawWindowThrottleTime = 100;

  /** @type {HTMLCanvasElement} */
  let canvas;
  /** @type {HTMLElement} */
  let main;
  /** @type {import('../..').BotWindow} */ 
  let botWindow;
  /** @type {HTMLCanvasElement} */
  let draggedItemElement;
  /** @type {ReturnType<import('socket.io-client').io.io>} */
  let socket;
  /** @type {HTMLElement} */
  let targetStuffContainer

  /** @type {import("../../utils").DetailedItem | null} */
  let draggedItem = null;

  let windowsCoordinates;

  // Draw window reactively when `botWindow` changes
  $: drawWindow(botWindow);

  document.body.addEventListener('click', (ev) => {
    if (ev.target === document.body) {
      console.log('Clicked')
    }
  })

  /**
     * @param {HTMLElement} element
     * @param {number} x
     * @param {number} y
     */
  function setElementAbsPosition(element, x, y) {
    element.style.left = x - (element.parentElement?.getBoundingClientRect().left ?? 0) + 'px'
    element.style.top = y - (element.parentElement?.getBoundingClientRect().top ?? 0) + 'px'
  }

  /**
   * @param {MouseEvent} ev
   */
  function moveDraggedItemElement(ev) { setElementAbsPosition(draggedItemElement, ev.clientX, ev.clientY) }

  const drawSlot = async function(/** @type {CanvasRenderingContext2D | null} */ ctx, /** @type {import('../../utils').DetailedItem | undefined} */ item, /** @type {number | undefined} */ x, /** @type {number | undefined} */ y) {
    if (!ctx) { return }
    if (!item) { return }
    if (!item.texture) { return }
    if (x === undefined || y === undefined) { return }

    const slotImage = new Image();
    slotImage.src = item.texture;

    slotImage.onload = function () {
      // Draw slot image
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        slotImage,
        x,
        y,
        32,
        32
      );

      // Draw slot count
      if (item.count > 1) {
        ctx.font = "16px Minecraftia";
        ctx.fillStyle = "black";
        ctx.textAlign = "end";
        ctx.fillText(
          item.count + '',
          x + 34,
          y + 32
        );
        ctx.fillStyle = "white";
        ctx.fillText(
          item.count + '',
          x + 32,
          y + 30
        );
      }

      // Draw slot durability (if any)
      if (item.durabilityLeft != null) {
        ctx.fillStyle = 'black';
        ctx.fillRect(
          x + 3, 
          y + 29, 
          28, 
          3
        );

        ctx.fillStyle = `hsl(${Math.round(item.durabilityLeft*120)}, 100%, 50%)`;
        ctx.fillRect(
          x + 3, 
          y + 29, 
          Math.round(item.durabilityLeft*28), 
          2
        );
      }
    };
  }

  const drawSlots = async function(/** @type {CanvasRenderingContext2D | null} */ ctx, botWindow) {
    if (!ctx) { return }

    // Draw background
    await /** @type {Promise<void>} */(new Promise((resolve) => {
      const windowImage = new Image();
      windowImage.addEventListener("load", function () {
        canvas.width = windowImage.width;
        canvas.height = windowImage.height;
        main.style.width = windowImage.width + 'px';
        main.style.height = windowImage.height + 'px';

        ctx.reset()
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(windowImage, 0, 0);

        resolve();
      });
      windowImage.src = `windows/${botWindow?.type ?? "inventory"}.png`;
    }));

    for (const slot in botWindow.slots) {
      /** @type {import('../../utils').DetailedItem} */ 
      const item = botWindow.slots[slot]
    
      const slotCoordinates = (windowsCoordinates[botWindow.type]) ? windowsCoordinates[botWindow.type][slot] : undefined;
      if (!slotCoordinates) continue;

      if (!item) { continue; }

      if (item.texture && slotCoordinates) {
        drawSlot(ctx, item, slotCoordinates[0], slotCoordinates[1])
      }
    }
  }

  const drawWindow = throttle(async (botWindow) => {
    if (!botWindow) return;

    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    }, false);

    drawSlots(canvas.getContext("2d"), botWindow)

    // Draw slots
    for (const slot in botWindow.slots) {
      /** @type {import('../../utils').DetailedItem | undefined} */ 
      const item = botWindow.slots[slot]
    
      const slotCoordinates = (windowsCoordinates[botWindow.type]) ? windowsCoordinates[botWindow.type][slot] : undefined;
      if (!slotCoordinates) continue;

      const slotElement = document.createElement('div')
      slotElement.classList.add('item-slot')
      slotElement.style.left = slotCoordinates[0] + 'px'
      slotElement.style.top = slotCoordinates[1] + 'px'
      slotElement.style.width = '32px'
      slotElement.style.height = '32px'
      slotElement.addEventListener('contextmenu', function(e) {
        e.preventDefault();
      }, false)
      slotElement.addEventListener('mousedown', async function(e) {
        if (e.button !== 0) { return }
        if (draggedItem) {
          botWindow.slots[slot] = draggedItem
          await drawSlots(canvas.getContext("2d"), botWindow)

          socket.send({
            type: 'item-drop',
            from: draggedItem.slot,
            to: Number.parseInt(slot),
          })

          window.removeEventListener('mousemove', moveDraggedItemElement)
          draggedItemElement.style.display = 'none'
          draggedItem = null
        } else if (item) {
          slotElement.classList.add('picked-up')

          setElementAbsPosition(draggedItemElement, e.clientX, e.clientY)
          window.addEventListener('mousemove', moveDraggedItemElement)
          draggedItemElement.style.display = 'block'

          const ctx = draggedItemElement.getContext('2d')
          if (!ctx) { throw new Error(`Bruh`) }
          ctx.reset()
          ctx.clearRect(0, 0, draggedItemElement.width, draggedItemElement.height)
          await drawSlot(ctx, item, 0, 0)

          draggedItem = item

          botWindow.slots[item.slot] = null
          await drawSlots(canvas.getContext("2d"), botWindow)
        }
      }, false)
      main.appendChild(slotElement)

      if (!item) {
        slotElement.classList.add('empty-slot');
        continue;
      }

      if (item && slotCoordinates) {
        const hoverElement = document.createElement('div')
        hoverElement.innerText = `${item.displayName}`
        slotElement.onmousemove = (ev) => { setElementAbsPosition(hoverElement, ev.clientX, ev.clientY - hoverElement.clientHeight) }
        slotElement.appendChild(hoverElement)
      }
    }
  }, drawWindowThrottleTime);

  /**
     * @param {string} id
     * @param {'chest' | 'player'} type
     */
  function addTargetStuff(id, type) {
    const newTarget = document.createElement('div')
    newTarget.classList.add('slot')
    newTarget.id = 'target' + id

    const newTargetImage = document.createElement('img')
    newTargetImage.style.pointerEvents = 'none'
    newTargetImage.width = 32
    newTargetImage.height = 32
    newTarget.appendChild(newTargetImage)

    const newTargetSpan = document.createElement('span')
    newTargetSpan.innerText = id
    newTarget.appendChild(newTargetSpan)
    
    switch (type) {
      case 'chest':
        newTargetImage.src = '/chest.webp'
        newTargetImage.alt = 'Chest'
        break
    
      case 'player':
        newTargetImage.src = '/player.png'
        newTargetImage.alt = 'Player'
        break
    }

    targetStuffContainer.appendChild(newTarget)
    return newTarget
  }

  onMount(async () => {
    // Fetch Windows Coordinates
    windowsCoordinates = await (
      await fetch("windows/coordinates.json")
    ).json();

    /** @ts-ignore @type {ReturnType<import('socket.io-client').io.io>} */
    socket = io({
      path: window.location.pathname + 'socket.io',
    });

    socket.on("window", function (_botWindow) {
      botWindow = receiveWindow(botWindow, _botWindow);
    });

    socket.on("windowUpdate", function (_windowUpdate) {
      botWindow = updateWindow(botWindow, _windowUpdate);
    });

    socket.on("targets", function (/** @type {any} */ targets) {
      targetStuffContainer.style.display = 'inline-block'
      targetStuffContainer.innerHTML = ''
      for (const target of targets) {
        const targetElement = addTargetStuff(target.id, target.type)
        targetElement.addEventListener('click', (ev) => {
          if (draggedItem) {
            socket.send({
              type: 'item-send',
              from: draggedItem.slot,
              to: target,
            })

            botWindow.slots[draggedItem.slot] = draggedItem

            window.removeEventListener('mousemove', moveDraggedItemElement)
            draggedItemElement.style.display = 'none'
            draggedItem = null

            drawSlots(canvas.getContext('2d'), botWindow)
          }
        })
      }
    });

    // onDestroy
    return () => {
      socket.disconnect();
    };
  });
</script>

<svelte:head>
  <title>mineflayer bot's inventory</title>
</svelte:head>

<div bind:this={targetStuffContainer} id="target-stuff" style="display: none;">
  
</div>

<main bind:this={main}>
  <canvas bind:this={canvas} id="windowCanvas" width="352" height="332">
    <p> Upgrade your browser and/or activate JavaScript to see the graphical inventory </p>
  </canvas>

  <canvas bind:this={draggedItemElement} id="dragging-item" style="display: none;" width=32 height=32></canvas>
</main>

{#if botWindow}
  {#if botWindow.unsupported}
    <p style="color: red;">The current window is not supported but mineflayer-web-inventory will still try to show you inventory updates</p>
  {/if}
{/if}
