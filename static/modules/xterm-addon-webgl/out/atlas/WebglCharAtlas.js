"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebglCharAtlas = void 0;
var Constants_1 = require("browser/renderer/atlas/Constants");
var Constants_2 = require("common/buffer/Constants");
var WebglUtils_1 = require("../WebglUtils");
var AttributeData_1 = require("common/buffer/AttributeData");
var Color_1 = require("browser/Color");
var TEXTURE_WIDTH = 1024;
var TEXTURE_HEIGHT = 1024;
var TEXTURE_CAPACITY = Math.floor(TEXTURE_HEIGHT * 0.8);
var TRANSPARENT_COLOR = {
    css: 'rgba(0, 0, 0, 0)',
    rgba: 0
};
var NULL_RASTERIZED_GLYPH = {
    offset: { x: 0, y: 0 },
    texturePosition: { x: 0, y: 0 },
    texturePositionClipSpace: { x: 0, y: 0 },
    size: { x: 0, y: 0 },
    sizeClipSpace: { x: 0, y: 0 }
};
var TMP_CANVAS_GLYPH_PADDING = 2;
var WebglCharAtlas = (function () {
    function WebglCharAtlas(document, _config) {
        this._config = _config;
        this._didWarmUp = false;
        this._cacheMap = {};
        this._cacheMapCombined = {};
        this._currentRowY = 0;
        this._currentRowX = 0;
        this._currentRowHeight = 0;
        this.hasCanvasChanged = false;
        this._workBoundingBox = { top: 0, left: 0, bottom: 0, right: 0 };
        this._workAttributeData = new AttributeData_1.AttributeData();
        this.cacheCanvas = document.createElement('canvas');
        this.cacheCanvas.width = TEXTURE_WIDTH;
        this.cacheCanvas.height = TEXTURE_HEIGHT;
        this._cacheCtx = WebglUtils_1.throwIfFalsy(this.cacheCanvas.getContext('2d', { alpha: true }));
        this._tmpCanvas = document.createElement('canvas');
        this._tmpCanvas.width = this._config.scaledCharWidth * 2 + TMP_CANVAS_GLYPH_PADDING * 2;
        this._tmpCanvas.height = this._config.scaledCharHeight + TMP_CANVAS_GLYPH_PADDING * 2;
        this._tmpCtx = WebglUtils_1.throwIfFalsy(this._tmpCanvas.getContext('2d', { alpha: this._config.allowTransparency }));
    }
    WebglCharAtlas.prototype.dispose = function () {
        if (this.cacheCanvas.parentElement) {
            this.cacheCanvas.parentElement.removeChild(this.cacheCanvas);
        }
    };
    WebglCharAtlas.prototype.warmUp = function () {
        if (!this._didWarmUp) {
            this._doWarmUp();
            this._didWarmUp = true;
        }
    };
    WebglCharAtlas.prototype._doWarmUp = function () {
        var _a, _b;
        for (var i = 33; i < 126; i++) {
            var rasterizedGlyph = this._drawToCache(i, Constants_2.DEFAULT_COLOR, Constants_2.DEFAULT_COLOR);
            this._cacheMap[i] = (_a = {},
                _a[Constants_2.DEFAULT_COLOR] = (_b = {},
                    _b[Constants_2.DEFAULT_COLOR] = rasterizedGlyph,
                    _b),
                _a);
        }
    };
    WebglCharAtlas.prototype.beginFrame = function () {
        if (this._currentRowY > TEXTURE_CAPACITY) {
            this.clearTexture();
            this.warmUp();
            return true;
        }
        return false;
    };
    WebglCharAtlas.prototype.clearTexture = function () {
        if (this._currentRowX === 0 && this._currentRowY === 0) {
            return;
        }
        this._cacheCtx.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
        this._cacheMap = {};
        this._cacheMapCombined = {};
        this._currentRowHeight = 0;
        this._currentRowX = 0;
        this._currentRowY = 0;
        this._didWarmUp = false;
    };
    WebglCharAtlas.prototype.getRasterizedGlyphCombinedChar = function (chars, bg, fg) {
        var rasterizedGlyphSet = this._cacheMapCombined[chars];
        if (!rasterizedGlyphSet) {
            rasterizedGlyphSet = {};
            this._cacheMapCombined[chars] = rasterizedGlyphSet;
        }
        var rasterizedGlyph;
        var rasterizedGlyphSetBg = rasterizedGlyphSet[bg];
        if (rasterizedGlyphSetBg) {
            rasterizedGlyph = rasterizedGlyphSetBg[fg];
        }
        if (!rasterizedGlyph) {
            rasterizedGlyph = this._drawToCache(chars, bg, fg);
            if (!rasterizedGlyphSet[bg]) {
                rasterizedGlyphSet[bg] = {};
            }
            rasterizedGlyphSet[bg][fg] = rasterizedGlyph;
        }
        return rasterizedGlyph;
    };
    WebglCharAtlas.prototype.getRasterizedGlyph = function (code, bg, fg) {
        var rasterizedGlyphSet = this._cacheMap[code];
        if (!rasterizedGlyphSet) {
            rasterizedGlyphSet = {};
            this._cacheMap[code] = rasterizedGlyphSet;
        }
        var rasterizedGlyph;
        var rasterizedGlyphSetBg = rasterizedGlyphSet[bg];
        if (rasterizedGlyphSetBg) {
            rasterizedGlyph = rasterizedGlyphSetBg[fg];
        }
        if (!rasterizedGlyph) {
            rasterizedGlyph = this._drawToCache(code, bg, fg);
            if (!rasterizedGlyphSet[bg]) {
                rasterizedGlyphSet[bg] = {};
            }
            rasterizedGlyphSet[bg][fg] = rasterizedGlyph;
        }
        return rasterizedGlyph;
    };
    WebglCharAtlas.prototype._getColorFromAnsiIndex = function (idx) {
        if (idx >= this._config.colors.ansi.length) {
            throw new Error('No color found for idx ' + idx);
        }
        return this._config.colors.ansi[idx];
    };
    WebglCharAtlas.prototype._getBackgroundColor = function (bgColorMode, bgColor, inverse) {
        if (this._config.allowTransparency) {
            return TRANSPARENT_COLOR;
        }
        switch (bgColorMode) {
            case 16777216:
            case 33554432:
                return this._getColorFromAnsiIndex(bgColor);
            case 50331648:
                var arr = AttributeData_1.AttributeData.toColorRGB(bgColor);
                return {
                    rgba: bgColor << 8,
                    css: "#" + toPaddedHex(arr[0]) + toPaddedHex(arr[1]) + toPaddedHex(arr[2])
                };
            case 0:
            default:
                if (inverse) {
                    return this._config.colors.foreground;
                }
                return this._config.colors.background;
        }
    };
    WebglCharAtlas.prototype._getForegroundCss = function (bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold) {
        var minimumContrastCss = this._getMinimumContrastCss(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold);
        if (minimumContrastCss) {
            return minimumContrastCss;
        }
        switch (fgColorMode) {
            case 16777216:
            case 33554432:
                if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
                    fgColor += 8;
                }
                return this._getColorFromAnsiIndex(fgColor).css;
            case 50331648:
                var arr = AttributeData_1.AttributeData.toColorRGB(fgColor);
                return Color_1.channels.toCss(arr[0], arr[1], arr[2]);
            case 0:
            default:
                if (inverse) {
                    var bg_1 = this._config.colors.background.css;
                    if (bg_1.length === 9) {
                        return bg_1.substr(0, 7);
                    }
                    return bg_1;
                }
                return this._config.colors.foreground.css;
        }
    };
    WebglCharAtlas.prototype._resolveBackgroundRgba = function (bgColorMode, bgColor, inverse) {
        switch (bgColorMode) {
            case 16777216:
            case 33554432:
                return this._getColorFromAnsiIndex(bgColor).rgba;
            case 50331648:
                return bgColor << 8;
            case 0:
            default:
                if (inverse) {
                    return this._config.colors.foreground.rgba;
                }
                return this._config.colors.background.rgba;
        }
    };
    WebglCharAtlas.prototype._resolveForegroundRgba = function (fgColorMode, fgColor, inverse, bold) {
        switch (fgColorMode) {
            case 16777216:
            case 33554432:
                if (this._config.drawBoldTextInBrightColors && bold && fgColor < 8) {
                    fgColor += 8;
                }
                return this._getColorFromAnsiIndex(fgColor).rgba;
            case 50331648:
                return fgColor << 8;
            case 0:
            default:
                if (inverse) {
                    return this._config.colors.background.rgba;
                }
                return this._config.colors.foreground.rgba;
        }
    };
    WebglCharAtlas.prototype._getMinimumContrastCss = function (bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold) {
        if (this._config.minimumContrastRatio === 1) {
            return undefined;
        }
        var adjustedColor = this._config.colors.contrastCache.getCss(bg, fg);
        if (adjustedColor !== undefined) {
            return adjustedColor || undefined;
        }
        var bgRgba = this._resolveBackgroundRgba(bgColorMode, bgColor, inverse);
        var fgRgba = this._resolveForegroundRgba(fgColorMode, fgColor, inverse, bold);
        var result = Color_1.rgba.ensureContrastRatio(bgRgba, fgRgba, this._config.minimumContrastRatio);
        if (!result) {
            this._config.colors.contrastCache.setCss(bg, fg, null);
            return undefined;
        }
        var css = Color_1.channels.toCss((result >> 24) & 0xFF, (result >> 16) & 0xFF, (result >> 8) & 0xFF);
        this._config.colors.contrastCache.setCss(bg, fg, css);
        return css;
    };
    WebglCharAtlas.prototype._drawToCache = function (codeOrChars, bg, fg) {
        var chars = typeof codeOrChars === 'number' ? String.fromCharCode(codeOrChars) : codeOrChars;
        this.hasCanvasChanged = true;
        this._tmpCtx.save();
        this._workAttributeData.fg = fg;
        this._workAttributeData.bg = bg;
        var invisible = !!this._workAttributeData.isInvisible();
        if (invisible) {
            return NULL_RASTERIZED_GLYPH;
        }
        var bold = !!this._workAttributeData.isBold();
        var inverse = !!this._workAttributeData.isInverse();
        var dim = !!this._workAttributeData.isDim();
        var italic = !!this._workAttributeData.isItalic();
        var fgColor = this._workAttributeData.getFgColor();
        var fgColorMode = this._workAttributeData.getFgColorMode();
        var bgColor = this._workAttributeData.getBgColor();
        var bgColorMode = this._workAttributeData.getBgColorMode();
        if (inverse) {
            var temp = fgColor;
            fgColor = bgColor;
            bgColor = temp;
            var temp2 = fgColorMode;
            fgColorMode = bgColorMode;
            bgColorMode = temp2;
        }
        var backgroundColor = this._getBackgroundColor(bgColorMode, bgColor, inverse);
        this._tmpCtx.globalCompositeOperation = 'copy';
        this._tmpCtx.fillStyle = backgroundColor.css;
        this._tmpCtx.fillRect(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
        this._tmpCtx.globalCompositeOperation = 'source-over';
        var fontWeight = bold ? this._config.fontWeightBold : this._config.fontWeight;
        var fontStyle = italic ? 'italic' : '';
        this._tmpCtx.font =
            fontStyle + " " + fontWeight + " " + this._config.fontSize * this._config.devicePixelRatio + "px " + this._config.fontFamily;
        this._tmpCtx.textBaseline = 'middle';
        this._tmpCtx.fillStyle = this._getForegroundCss(bg, bgColorMode, bgColor, fg, fgColorMode, fgColor, inverse, bold);
        if (dim) {
            this._tmpCtx.globalAlpha = Constants_1.DIM_OPACITY;
        }
        this._tmpCtx.fillText(chars, TMP_CANVAS_GLYPH_PADDING, TMP_CANVAS_GLYPH_PADDING + this._config.scaledCharHeight / 2);
        this._tmpCtx.restore();
        var imageData = this._tmpCtx.getImageData(0, 0, this._tmpCanvas.width, this._tmpCanvas.height);
        var isEmpty = clearColor(imageData, backgroundColor);
        if (isEmpty) {
            return NULL_RASTERIZED_GLYPH;
        }
        var rasterizedGlyph = this._findGlyphBoundingBox(imageData, this._workBoundingBox);
        var clippedImageData = this._clipImageData(imageData, this._workBoundingBox);
        if (this._currentRowX + this._config.scaledCharWidth > TEXTURE_WIDTH) {
            this._currentRowX = 0;
            this._currentRowY += this._currentRowHeight;
            this._currentRowHeight = 0;
        }
        rasterizedGlyph.texturePosition.x = this._currentRowX;
        rasterizedGlyph.texturePosition.y = this._currentRowY;
        rasterizedGlyph.texturePositionClipSpace.x = this._currentRowX / TEXTURE_WIDTH;
        rasterizedGlyph.texturePositionClipSpace.y = this._currentRowY / TEXTURE_HEIGHT;
        this._currentRowHeight = Math.max(this._currentRowHeight, rasterizedGlyph.size.y);
        this._currentRowX += rasterizedGlyph.size.x;
        this._cacheCtx.putImageData(clippedImageData, rasterizedGlyph.texturePosition.x, rasterizedGlyph.texturePosition.y);
        return rasterizedGlyph;
    };
    WebglCharAtlas.prototype._findGlyphBoundingBox = function (imageData, boundingBox) {
        boundingBox.top = 0;
        var found = false;
        for (var y = 0; y < this._tmpCanvas.height; y++) {
            for (var x = 0; x < this._tmpCanvas.width; x++) {
                var alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
                if (imageData.data[alphaOffset] !== 0) {
                    boundingBox.top = y;
                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        boundingBox.left = 0;
        found = false;
        for (var x = 0; x < this._tmpCanvas.width; x++) {
            for (var y = 0; y < this._tmpCanvas.height; y++) {
                var alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
                if (imageData.data[alphaOffset] !== 0) {
                    boundingBox.left = x;
                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        boundingBox.right = this._tmpCanvas.width;
        found = false;
        for (var x = this._tmpCanvas.width - 1; x >= 0; x--) {
            for (var y = 0; y < this._tmpCanvas.height; y++) {
                var alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
                if (imageData.data[alphaOffset] !== 0) {
                    boundingBox.right = x;
                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        boundingBox.bottom = this._tmpCanvas.height;
        found = false;
        for (var y = this._tmpCanvas.height - 1; y >= 0; y--) {
            for (var x = 0; x < this._tmpCanvas.width; x++) {
                var alphaOffset = y * this._tmpCanvas.width * 4 + x * 4 + 3;
                if (imageData.data[alphaOffset] !== 0) {
                    boundingBox.bottom = y;
                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        return {
            texturePosition: { x: 0, y: 0 },
            texturePositionClipSpace: { x: 0, y: 0 },
            size: {
                x: boundingBox.right - boundingBox.left + 1,
                y: boundingBox.bottom - boundingBox.top + 1
            },
            sizeClipSpace: {
                x: (boundingBox.right - boundingBox.left + 1) / TEXTURE_WIDTH,
                y: (boundingBox.bottom - boundingBox.top + 1) / TEXTURE_HEIGHT
            },
            offset: {
                x: -boundingBox.left + TMP_CANVAS_GLYPH_PADDING,
                y: -boundingBox.top + TMP_CANVAS_GLYPH_PADDING
            }
        };
    };
    WebglCharAtlas.prototype._clipImageData = function (imageData, boundingBox) {
        var width = boundingBox.right - boundingBox.left + 1;
        var height = boundingBox.bottom - boundingBox.top + 1;
        var clippedData = new Uint8ClampedArray(width * height * 4);
        for (var y = boundingBox.top; y <= boundingBox.bottom; y++) {
            for (var x = boundingBox.left; x <= boundingBox.right; x++) {
                var oldOffset = y * this._tmpCanvas.width * 4 + x * 4;
                var newOffset = (y - boundingBox.top) * width * 4 + (x - boundingBox.left) * 4;
                clippedData[newOffset] = imageData.data[oldOffset];
                clippedData[newOffset + 1] = imageData.data[oldOffset + 1];
                clippedData[newOffset + 2] = imageData.data[oldOffset + 2];
                clippedData[newOffset + 3] = imageData.data[oldOffset + 3];
            }
        }
        return new ImageData(clippedData, width, height);
    };
    return WebglCharAtlas;
}());
exports.WebglCharAtlas = WebglCharAtlas;
function clearColor(imageData, color) {
    var isEmpty = true;
    var r = color.rgba >>> 24;
    var g = color.rgba >>> 16 & 0xFF;
    var b = color.rgba >>> 8 & 0xFF;
    for (var offset = 0; offset < imageData.data.length; offset += 4) {
        if (imageData.data[offset] === r &&
            imageData.data[offset + 1] === g &&
            imageData.data[offset + 2] === b) {
            imageData.data[offset + 3] = 0;
        }
        else {
            isEmpty = false;
        }
    }
    return isEmpty;
}
function toPaddedHex(c) {
    var s = c.toString(16);
    return s.length < 2 ? '0' + s : s;
}
//# sourceMappingURL=WebglCharAtlas.js.map