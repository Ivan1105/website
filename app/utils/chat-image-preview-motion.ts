type ImageRect = Pick<DOMRectReadOnly, 'top' | 'left' | 'width' | 'height'>

function visibleThumbnail(image: HTMLImageElement | undefined): ImageRect | undefined {
  if (!image?.isConnected) return
  const rect = image.getBoundingClientRect()
  const scrollport = image.closest('.messages-area')?.getBoundingClientRect()
  if (rect.width && rect.height
    && rect.right > Math.max(0, scrollport?.left ?? 0)
    && rect.bottom > Math.max(0, scrollport?.top ?? 0)
    && rect.left < Math.min(window.innerWidth, scrollport?.right ?? window.innerWidth)
    && rect.top < Math.min(window.innerHeight, scrollport?.bottom ?? window.innerHeight)) {
    return rect
  }
}

function centeredExit(from: ImageRect): ImageRect {
  const scale = 0.8 * Math.min(1, window.innerWidth / from.width, window.innerHeight / from.height)
  const width = from.width * scale
  const height = from.height * scale
  return { width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 }
}

function transform(base: ImageRect, target: ImageRect): Keyframe {
  return {
    transformOrigin: 'top left',
    transform: `translate(${target.left - base.left}px, ${target.top - base.top}px) scale(${target.width / base.width}, ${target.height / base.height})`,
  }
}

function translateHorizontal(rect: ImageRect, distance: number): ImageRect {
  return { left: rect.left + distance, top: rect.top, width: rect.width, height: rect.height }
}

export function createChatImagePreviewMotion() {
  let imageAnimation: Animation | undefined
  let chromeAnimations: Animation[] = []
  let backdrop: HTMLElement | undefined
  let backdropColor = ''
  let outgoing: { image: HTMLImageElement, box: ImageRect, swipeOffset: number } | undefined
  let outgoingAnimation: Animation | undefined
  let switchDirection = 0

  function canAnimate(element: HTMLElement) {
    return typeof element.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function timing(duration: number): KeyframeAnimationOptions {
    return { duration, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'both' }
  }

  function removeOutgoing() {
    outgoingAnimation?.cancel()
    outgoingAnimation = undefined
    outgoing?.image.remove()
    outgoing = undefined
  }

  function cancelImage() {
    imageAnimation?.cancel()
    imageAnimation = undefined
    switchDirection = 0
    removeOutgoing()
  }

  function cancelChrome() {
    for (const animation of chromeAnimations) animation.cancel()
    chromeAnimations = []
  }

  function animateChrome(controls: HTMLElement | null, visible: boolean, duration: number) {
    if (!backdrop) return []
    const background = getComputedStyle(backdrop).backgroundColor
    const opacity = controls ? getComputedStyle(controls).opacity : ''
    cancelChrome()
    const nextBackground = visible ? backdropColor : 'rgba(0, 0, 0, 0)'
    const nextOpacity = visible ? '1' : '0'
    backdrop.style.backgroundColor = nextBackground
    if (controls) controls.style.opacity = nextOpacity
    if (!canAnimate(backdrop)) return []

    function add(element: HTMLElement, from: Keyframe, to: Keyframe) {
      const animation = element.animate([from, to], timing(duration))
      chromeAnimations.push(animation)
      // The inline style already holds the final value after the effect is removed.
      animation.onfinish = () => animation.cancel()
    }

    if (background !== nextBackground) add(backdrop, { backgroundColor: background }, { backgroundColor: nextBackground })
    if (controls && opacity !== nextOpacity) add(controls, { opacity }, { opacity: nextOpacity })
    return chromeAnimations
  }

  function playImage(image: HTMLImageElement, from: ImageRect, to: ImageRect, duration: number) {
    const base = image.getBoundingClientRect()
    if (!base.width || !base.height || !from.width || !from.height) return
    imageAnimation = image.animate([transform(base, from), transform(base, to)], timing(duration))
    return imageAnimation
  }

  return {
    prepare(element: HTMLElement) {
      backdrop = element
      backdropColor = getComputedStyle(element).backgroundColor
      if (canAnimate(element)) element.style.backgroundColor = 'transparent'
    },
    cancelImage,
    cancel() {
      cancelImage()
      cancelChrome()
    },
    open(controls: HTMLElement | null, image?: HTMLImageElement, thumbnail?: HTMLImageElement) {
      animateChrome(controls, true, 220)
      if (!image || !canAnimate(image)) return
      const from = visibleThumbnail(thumbnail)
      if (!from) return
      const animation = playImage(image, from, image.getBoundingClientRect(), 220)
      if (animation) animation.onfinish = () => {
        if (imageAnimation === animation) cancelImage()
      }
    },
    startSwitch(image: HTMLImageElement | undefined, direction: number, fromSwipe: boolean) {
      if (!backdrop || !canAnimate(backdrop)) {
        cancelImage()
        return
      }
      // Viewer.js replaces its canvas image after the view event.
      if (image) {
        const box = image.getBoundingClientRect()
        const frame = backdrop.getBoundingClientRect()
        cancelImage()
        if (box.width && box.height) {
          const snapshot = document.createElement('img')
          snapshot.src = image.currentSrc || image.src
          snapshot.alt = ''
          snapshot.setAttribute('aria-hidden', 'true')
          snapshot.className = 'preview-outgoing-image'
          Object.assign(snapshot.style, {
            position: 'absolute',
            left: `${box.left - frame.left}px`,
            top: `${box.top - frame.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            maxWidth: 'none',
            pointerEvents: 'none',
            zIndex: '1',
          })
          backdrop.appendChild(snapshot)
          const shift = box.left + box.width / 2 - (frame.left + frame.width / 2)
          outgoing = { image: snapshot, box, swipeOffset: fromSwipe && shift * direction < 0 ? shift : 0 }
        }
      } else if (outgoingAnimation) {
        removeOutgoing()
      }
      switchDirection = direction
    },
    finishSwitch(image?: HTMLImageElement) {
      if (!switchDirection || !backdrop) return
      const width = backdrop.clientWidth
      const distance = switchDirection * Math.max(width * 0.2, width - Math.abs(outgoing?.swipeOffset ?? 0))
      switchDirection = 0
      if (outgoing) {
        const { box, image: previous } = outgoing
        outgoingAnimation = previous.animate(
          [transform(box, box), transform(box, translateHorizontal(box, -distance))],
          timing(240),
        )
        outgoingAnimation.onfinish = removeOutgoing
      }
      if (image) {
        const to = image.getBoundingClientRect()
        const animation = playImage(image, translateHorizontal(to, distance), to, 240)
        if (animation) animation.onfinish = () => {
          if (imageAnimation === animation) cancelImage()
        }
      }
    },
    close(controls: HTMLElement | null, image: HTMLImageElement | undefined, thumbnail: HTMLImageElement | undefined, finish: () => void) {
      if (!backdrop || !canAnimate(backdrop)) return false
      // Read the animated position before cancelling an in-flight opening.
      const from = image?.getBoundingClientRect()
      cancelImage()
      const chrome = animateChrome(controls, false, 180)
      const slide = image && from?.width && from.height && canAnimate(image)
        ? playImage(image, from, visibleThumbnail(thumbnail) ?? centeredExit(from), 180)
        : undefined
      const animation = slide ?? chrome[0]
      if (!animation) return false
      animation.onfinish = finish
      return true
    },
  }
}
