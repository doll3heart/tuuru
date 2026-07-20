export const IMAGE_TARGET_BYTES = 500 * 1024
export const IMAGE_HARD_LIMIT_BYTES = 1024 * 1024
export const IMAGE_SOURCE_LIMIT_BYTES = 10 * 1024 * 1024
export const IMAGE_MAX_EDGE = 1920

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export class ImageCompressionError extends Error {
  constructor(message, code) {
    super(message)
    this.name = "ImageCompressionError"
    this.code = code
  }
}

function imageType(file) {
  var type = String(file?.type || "").toLowerCase()
  if (type === "image/jpg") type = "image/jpeg"
  if (SUPPORTED_TYPES.has(type)) return type
  var ext = String(file?.name || "").split(".").pop().toLowerCase()
  return ({jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif"})[ext] || ""
}

function defaultReadBlobAsDataURL(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader()
    reader.onload = function() { resolve(reader.result) }
    reader.onerror = function() { reject(new ImageCompressionError("图片读取失败", "read-failed")) }
    reader.readAsDataURL(blob)
  })
}

function defaultDecodeImageFile(file) {
  return new Promise(function(resolve, reject) {
    var url = URL.createObjectURL(file)
    var image = new Image()
    image.onload = function() {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: function() { URL.revokeObjectURL(url) },
      })
    }
    image.onerror = function() {
      URL.revokeObjectURL(url)
      reject(new ImageCompressionError("浏览器无法解码这张图片", "decode-failed"))
    }
    image.src = url
  })
}

function defaultEncodeImage(source, options) {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement("canvas")
    canvas.width = options.width
    canvas.height = options.height
    var context = canvas.getContext("2d")
    if (!context) {
      reject(new ImageCompressionError("浏览器无法创建图片画布", "canvas-unavailable"))
      return
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(source, 0, 0, options.width, options.height)
    canvas.toBlob(function(blob) {
      if (blob) resolve(blob)
      else reject(new ImageCompressionError("浏览器无法压缩这张图片", "encode-failed"))
    }, options.type, options.quality)
  })
}

function boundedDimensions(width, height) {
  if (!(width > 0) || !(height > 0)) throw new ImageCompressionError("图片尺寸无效", "invalid-dimensions")
  var scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function compressEditorImage(file, environment = {}) {
  if (!file || !(file.size >= 0)) throw new ImageCompressionError("没有可处理的图片", "missing-file")
  if (file.size > IMAGE_SOURCE_LIMIT_BYTES) throw new ImageCompressionError("原图超过 10MB", "source-too-large")
  var type = imageType(file)
  if (!type) throw new ImageCompressionError("仅支持 JPG、PNG、WebP 和 GIF 图片", "unsupported-type")

  var readBlobAsDataURL = environment.readBlobAsDataURL || defaultReadBlobAsDataURL
  if (file.size <= IMAGE_TARGET_BYTES) {
    return {dataUrl: await readBlobAsDataURL(file), originalBytes:file.size, outputBytes:file.size, compressed:false}
  }
  if (type === "image/gif") {
    if (file.size > IMAGE_HARD_LIMIT_BYTES) {
      throw new ImageCompressionError("动态 GIF 超过 1MB，自动压缩会丢失动画，请先压缩后再导入", "animated-image-too-large")
    }
    return {dataUrl: await readBlobAsDataURL(file), originalBytes:file.size, outputBytes:file.size, compressed:false}
  }

  var decodeImageFile = environment.decodeImageFile || defaultDecodeImageFile
  var encodeImage = environment.encodeImage || defaultEncodeImage
  var decoded = await decodeImageFile(file)
  var dimensions = boundedDimensions(decoded.width, decoded.height)
  var outputType = type === "image/jpeg" ? "image/jpeg" : "image/webp"
  var qualities = [0.84, 0.72, 0.6, 0.5]
  var best = null

  try {
    for (var round = 0; round < 3; round++) {
      for (var qi = 0; qi < qualities.length; qi++) {
        var options = {width:dimensions.width, height:dimensions.height, type:outputType, quality:qualities[qi]}
        var candidate = await encodeImage(decoded.source, options)
        if (!best || candidate.size < best.size) best = candidate
        if (candidate.size <= IMAGE_TARGET_BYTES) {
          return {
            dataUrl: await readBlobAsDataURL(candidate),
            originalBytes:file.size,
            outputBytes:candidate.size,
            compressed:true,
          }
        }
      }
      dimensions.width = Math.max(1, Math.round(dimensions.width * 0.8))
      dimensions.height = Math.max(1, Math.round(dimensions.height * 0.8))
    }

    if (best && best.size <= IMAGE_HARD_LIMIT_BYTES) {
      return {dataUrl:await readBlobAsDataURL(best), originalBytes:file.size, outputBytes:best.size, compressed:true}
    }
    throw new ImageCompressionError("压缩后仍超过 1MB，请选择更小的图片", "output-too-large")
  } finally {
    decoded?.close?.()
  }
}
