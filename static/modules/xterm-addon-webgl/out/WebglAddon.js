"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebglAddon = void 0;
var WebglRenderer_1 = require("./WebglRenderer");
var WebglAddon = (function () {
    function WebglAddon(_preserveDrawingBuffer) {
        this._preserveDrawingBuffer = _preserveDrawingBuffer;
    }
    WebglAddon.prototype.activate = function (terminal) {
        if (!terminal.element) {
            throw new Error('Cannot activate WebglAddon before Terminal.open');
        }
        this._terminal = terminal;
        var renderService = terminal._core._renderService;
        var colors = terminal._core._colorManager.colors;
        this._renderer = new WebglRenderer_1.WebglRenderer(terminal, colors, this._preserveDrawingBuffer);
        renderService.setRenderer(this._renderer);
    };
    WebglAddon.prototype.dispose = function () {
        if (!this._terminal) {
            throw new Error('Cannot dispose WebglAddon because it is activated');
        }
        var renderService = this._terminal._core._renderService;
        renderService.setRenderer(this._terminal._core._createRenderer());
        renderService.onResize(this._terminal.cols, this._terminal.rows);
        this._renderer = undefined;
    };
    Object.defineProperty(WebglAddon.prototype, "textureAtlas", {
        get: function () {
            var _a;
            return (_a = this._renderer) === null || _a === void 0 ? void 0 : _a.textureAtlas;
        },
        enumerable: false,
        configurable: true
    });
    WebglAddon.prototype.clearTextureAtlas = function () {
        var _a;
        (_a = this._renderer) === null || _a === void 0 ? void 0 : _a.clearCharAtlas();
    };
    return WebglAddon;
}());
exports.WebglAddon = WebglAddon;
//# sourceMappingURL=WebglAddon.js.map