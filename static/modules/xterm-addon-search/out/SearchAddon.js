"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchAddon = void 0;
var NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\;:"\',./<>?';
var LINES_CACHE_TIME_TO_LIVE = 15 * 1000;
var SearchAddon = (function () {
    function SearchAddon() {
        this._linesCacheTimeoutId = 0;
    }
    SearchAddon.prototype.activate = function (terminal) {
        this._terminal = terminal;
    };
    SearchAddon.prototype.dispose = function () { };
    SearchAddon.prototype.findNext = function (term, searchOptions) {
        if (!this._terminal) {
            throw new Error('Cannot use addon until it has been loaded');
        }
        if (!term || term.length === 0) {
            this._terminal.clearSelection();
            return false;
        }
        var startCol = 0;
        var startRow = 0;
        var currentSelection;
        if (this._terminal.hasSelection()) {
            var incremental = searchOptions ? searchOptions.incremental : false;
            currentSelection = this._terminal.getSelectionPosition();
            startRow = incremental ? currentSelection.startRow : currentSelection.endRow;
            startCol = incremental ? currentSelection.startColumn : currentSelection.endColumn;
        }
        this._initLinesCache();
        var searchPosition = {
            startRow: startRow,
            startCol: startCol
        };
        var result = this._findInLine(term, searchPosition, searchOptions);
        if (!result) {
            for (var y = startRow + 1; y < this._terminal.buffer.active.baseY + this._terminal.rows; y++) {
                searchPosition.startRow = y;
                searchPosition.startCol = 0;
                result = this._findInLine(term, searchPosition, searchOptions);
                if (result) {
                    break;
                }
            }
        }
        if (!result && startRow !== 0) {
            for (var y = 0; y < startRow; y++) {
                searchPosition.startRow = y;
                searchPosition.startCol = 0;
                result = this._findInLine(term, searchPosition, searchOptions);
                if (result) {
                    break;
                }
            }
        }
        if (!result && currentSelection) {
            searchPosition.startRow = currentSelection.startRow;
            searchPosition.startCol = 0;
            result = this._findInLine(term, searchPosition, searchOptions);
        }
        return this._selectResult(result);
    };
    SearchAddon.prototype.findPrevious = function (term, searchOptions) {
        if (!this._terminal) {
            throw new Error('Cannot use addon until it has been loaded');
        }
        if (!term || term.length === 0) {
            this._terminal.clearSelection();
            return false;
        }
        var isReverseSearch = true;
        var startRow = this._terminal.buffer.active.baseY + this._terminal.rows;
        var startCol = this._terminal.cols;
        var result;
        var incremental = searchOptions ? searchOptions.incremental : false;
        var currentSelection;
        if (this._terminal.hasSelection()) {
            currentSelection = this._terminal.getSelectionPosition();
            startRow = currentSelection.startRow;
            startCol = currentSelection.startColumn;
        }
        this._initLinesCache();
        var searchPosition = {
            startRow: startRow,
            startCol: startCol
        };
        if (incremental) {
            result = this._findInLine(term, searchPosition, searchOptions, false);
            if (!(result && result.row === startRow && result.col === startCol)) {
                result = this._findInLine(term, searchPosition, searchOptions, true);
            }
        }
        else {
            result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        }
        if (!result) {
            searchPosition.startCol = Math.max(searchPosition.startCol, this._terminal.cols);
            for (var y = startRow - 1; y >= 0; y--) {
                searchPosition.startRow = y;
                result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
                if (result) {
                    break;
                }
            }
        }
        if (!result && startRow !== (this._terminal.buffer.active.baseY + this._terminal.rows)) {
            for (var y = (this._terminal.buffer.active.baseY + this._terminal.rows); y >= startRow; y--) {
                searchPosition.startRow = y;
                result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
                if (result) {
                    break;
                }
            }
        }
        if (!result && currentSelection)
            return true;
        return this._selectResult(result);
    };
    SearchAddon.prototype._initLinesCache = function () {
        var _this = this;
        var terminal = this._terminal;
        if (!this._linesCache) {
            this._linesCache = new Array(terminal.buffer.active.length);
            this._cursorMoveListener = terminal.onCursorMove(function () { return _this._destroyLinesCache(); });
            this._resizeListener = terminal.onResize(function () { return _this._destroyLinesCache(); });
        }
        window.clearTimeout(this._linesCacheTimeoutId);
        this._linesCacheTimeoutId = window.setTimeout(function () { return _this._destroyLinesCache(); }, LINES_CACHE_TIME_TO_LIVE);
    };
    SearchAddon.prototype._destroyLinesCache = function () {
        this._linesCache = undefined;
        if (this._cursorMoveListener) {
            this._cursorMoveListener.dispose();
            this._cursorMoveListener = undefined;
        }
        if (this._resizeListener) {
            this._resizeListener.dispose();
            this._resizeListener = undefined;
        }
        if (this._linesCacheTimeoutId) {
            window.clearTimeout(this._linesCacheTimeoutId);
            this._linesCacheTimeoutId = 0;
        }
    };
    SearchAddon.prototype._isWholeWord = function (searchIndex, line, term) {
        return (((searchIndex === 0) || (NON_WORD_CHARACTERS.indexOf(line[searchIndex - 1]) !== -1)) &&
            (((searchIndex + term.length) === line.length) || (NON_WORD_CHARACTERS.indexOf(line[searchIndex + term.length]) !== -1)));
    };
    SearchAddon.prototype._findInLine = function (term, searchPosition, searchOptions, isReverseSearch) {
        if (searchOptions === void 0) { searchOptions = {}; }
        if (isReverseSearch === void 0) { isReverseSearch = false; }
        var terminal = this._terminal;
        var row = searchPosition.startRow;
        var col = searchPosition.startCol;
        var firstLine = terminal.buffer.active.getLine(row);
        if (firstLine && firstLine.isWrapped) {
            if (isReverseSearch) {
                searchPosition.startCol += terminal.cols;
                return;
            }
            searchPosition.startRow--;
            searchPosition.startCol += terminal.cols;
            return this._findInLine(term, searchPosition, searchOptions);
        }
        var stringLine = this._linesCache ? this._linesCache[row] : void 0;
        if (stringLine === void 0) {
            stringLine = this._translateBufferLineToStringWithWrap(row, true);
            if (this._linesCache) {
                this._linesCache[row] = stringLine;
            }
        }
        var searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
        var searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();
        var resultIndex = -1;
        if (searchOptions.regex) {
            var searchRegex = RegExp(searchTerm, 'g');
            var foundTerm = void 0;
            if (isReverseSearch) {
                while (foundTerm = searchRegex.exec(searchStringLine.slice(0, col))) {
                    resultIndex = searchRegex.lastIndex - foundTerm[0].length;
                    term = foundTerm[0];
                    searchRegex.lastIndex -= (term.length - 1);
                }
            }
            else {
                foundTerm = searchRegex.exec(searchStringLine.slice(col));
                if (foundTerm && foundTerm[0].length > 0) {
                    resultIndex = col + (searchRegex.lastIndex - foundTerm[0].length);
                    term = foundTerm[0];
                }
            }
        }
        else {
            if (isReverseSearch) {
                if (col - searchTerm.length >= 0) {
                    resultIndex = searchStringLine.lastIndexOf(searchTerm, col - searchTerm.length);
                }
            }
            else {
                resultIndex = searchStringLine.indexOf(searchTerm, col);
            }
        }
        if (resultIndex >= 0) {
            if (resultIndex >= terminal.cols) {
                row += Math.floor(resultIndex / terminal.cols);
                resultIndex = resultIndex % terminal.cols;
            }
            if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
                return;
            }
            var line = terminal.buffer.active.getLine(row);
            if (line) {
                for (var i = 0; i < resultIndex; i++) {
                    var cell = line.getCell(i);
                    if (!cell) {
                        break;
                    }
                    var char = cell.getChars();
                    if (char.length > 1) {
                        resultIndex -= char.length - 1;
                    }
                    var charWidth = cell.getWidth();
                    if (charWidth === 0) {
                        resultIndex++;
                    }
                }
            }
            return {
                term: term,
                col: resultIndex,
                row: row
            };
        }
    };
    SearchAddon.prototype._translateBufferLineToStringWithWrap = function (lineIndex, trimRight) {
        var terminal = this._terminal;
        var lineString = '';
        var lineWrapsToNext;
        do {
            var nextLine = terminal.buffer.active.getLine(lineIndex + 1);
            lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
            var line = terminal.buffer.active.getLine(lineIndex);
            if (!line) {
                break;
            }
            lineString += line.translateToString(!lineWrapsToNext && trimRight).substring(0, terminal.cols);
            lineIndex++;
        } while (lineWrapsToNext);
        return lineString;
    };
    SearchAddon.prototype._selectResult = function (result) {
        var terminal = this._terminal;
        if (!result) {
            terminal.clearSelection();
            return false;
        }
        terminal.select(result.col, result.row, result.term.length);
        if (result.row >= (terminal.buffer.active.viewportY + terminal.rows) || result.row < terminal.buffer.active.viewportY) {
            var scroll_1 = result.row - terminal.buffer.active.viewportY;
            scroll_1 = scroll_1 - Math.floor(terminal.rows / 2);
            terminal.scrollLines(scroll_1);
        }
        return true;
    };
    return SearchAddon;
}());
exports.SearchAddon = SearchAddon;
//# sourceMappingURL=SearchAddon.js.map