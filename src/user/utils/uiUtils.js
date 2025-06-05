// Simple notification system (can be expanded with a proper UI component)
export function showNotification(message, type = 'info', duration = 3000) {
  // In a real app, you'd integrate this with a notification component system
  console.log(`[${type.toUpperCase()}] ${message}`)
  const notificationElement = document.createElement('div')
  notificationElement.textContent = message
  notificationElement.style.position = 'fixed'
  notificationElement.style.bottom = '50px'
  notificationElement.style.left = '50%'
  notificationElement.style.transform = 'translateX(-50%)'
  notificationElement.style.padding = '10px 20px'
  notificationElement.style.borderRadius = '5px'
  notificationElement.style.backgroundColor = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue'
  notificationElement.style.color = 'white'
  notificationElement.style.zIndex = '10000'
  document.body.appendChild(notificationElement)
  setTimeout(() => {
    document.body.removeChild(notificationElement)
  }, duration)
}

export function errorMsg(message) {
  showNotification(message, 'error')
}

export function infoMsg(message) {
  showNotification(message, 'info')
}

export function successMsg(message) {
  showNotification(message, 'success')
}

export function shuffleArray(array) {
  let currentIndex = array.length
  let temporaryValue
  let randomIndex

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }
  return array
}

export const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export function parseSizeTuple(sizeString) {
  const parts = sizeString.split('x')
  if (parts.length !== 2) {
    errorMsg('Grid size should have the format "3x3", "5x7", etc.')
    return null
  }
  const height = parseInt(parts[0], 10)
  const width = parseInt(parts[1], 10)

  if (isNaN(height) || isNaN(width)) {
    errorMsg('Grid dimensions must be numbers.')
    return null
  }
  if (height < 1 || width < 1) {
    errorMsg('Grid size should be at least 1. Cannot have a grid with no cells.')
    return null
  }
  if (height > 30 || width > 30) {
    errorMsg('Grid size should be at most 30 per side. Pick a smaller size.')
    return null
  }
  return { height, width }
}
