(function (window, document) {

    var msie,
        slice = [].slice,
        splice = [].splice,
        push = [].push,
        toString = Object.prototype.toString,
        getPrototypeOf = Object.getPrototypeOf;


    function isUndef (v) {
        return typeof v === 'undefined';// || v === null
    }

    function isDef (v) {
        return typeof v !== 'undefined';// && v !== null
    }

    function isString (value) {
        return typeof value === 'string'
    }

    function isPlainObject (obj) {
        return toString.call(obj) === '[object Object]'
    }

    var lowercase = function(p) {
        return p.toLocaleLowerCase();
    };

    function trim (value) {
        return isString(value) ? value.replace(/^\s*/, '').replace(/\s*$/, '') : value;
    }

    function noop () {}

    function identifier (v) {
        return v;
    }

    var isArray = Array.isArray;

    /**
     * @private
     * @param {*} obj
     * @return {boolean} Returns true if `obj` is an array or array-like object (NodeList, Arguments,
     *                   String ...)
     */
    function isArrayLike(obj) {
        // `null`, `undefined` and `window` are not array-like
        if (obj == null || isWindow(obj)) return false;
        if (isArray(obj) || isString(obj)) return true;
        // Support: iOS 8.2 (not reproducible in simulator)
        // "length" in obj used to prevent JIT error (gh-11508)
        var length = 'length' in Object(obj) && obj.length;
        // NodeList objects (with `item` method) and
        // other objects with suitable length characteristics are array-like
        return isNumber(length) &&
            (length >= 0 && ((length - 1) in obj || obj instanceof Array) || typeof obj.item === 'function');
    }

    function isWindow(obj) {
        return obj && obj.window === obj;
    }

    function isNumber(value) {
        return typeof value === 'number';
    }

    /**
     * Determine if a value is an object with a null prototype
     *
     * @returns {boolean} True if `value` is an `Object` with a null prototype
     */
    function isBlankObject(value) {
        return value !== null && typeof value === 'object' && !getPrototypeOf(value);
    }

    function isFunction(value) {
        return typeof value === 'function';
    }

    function forEach(obj, iterator, context) {
        var key, length;
        if (obj) {
            if (isFunction(obj)) {
                for (key in obj) {
                    if (key !== 'prototype' && key !== 'length' && key !== 'name' && obj.hasOwnProperty(key)) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            } else if (isArray(obj) || isArrayLike(obj)) {
                var isPrimitive = typeof obj !== 'object';
                for (key = 0, length = obj.length; key < length; key++) {
                    if (isPrimitive || key in obj) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            } else if (obj.forEach && obj.forEach !== forEach) {
                obj.forEach(iterator, context, obj);
            } else if (isBlankObject(obj)) {
                // createMap() fast path --- Safe to avoid hasOwnProperty check because prototype chain is empty
                for (key in obj) {
                    iterator.call(context, obj[key], key, obj);
                }
            } else if (typeof obj.hasOwnProperty === 'function') {
                // Slow path for objects inheriting Object.prototype, hasOwnProperty check needed
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            } else {
                // Slow path for objects which do not have a method `hasOwnProperty`
                for (key in obj) {
                    if (hasOwnProperty.call(obj, key)) {
                        iterator.call(context, obj[key], key, obj);
                    }
                }
            }
        }
        return obj;
    }

    var DetectChanges = (function () {
        function DetectChanges (val) {
            this.prevValue = val;
        }

        DetectChanges.prototype.diff = function (val) {
            var isDiff = this.prevValue !== val;

            this.prevValue = val;

            return isDiff;
        };

        return DetectChanges;
    }());

    var Cache = (function () {
        var cache  = Object.create(null);

        function Cache () {
        }

        Cache.prototype.get = function (name) {
            return cache[name];
        };

        Cache.prototype.set = function (name, value) {
            cache[name] = value;
        };

        return Cache;
    }());

    /**
     * Creates a new object without a prototype. This object is useful for lookup without having to
     * guard against prototypically inherited properties via hasOwnProperty.
     *
     * Related micro-benchmarks:
     * - http://jsperf.com/object-create2
     * - http://jsperf.com/proto-map-lookup/2
     * - http://jsperf.com/for-in-vs-object-keys2
     *
     * @returns {Object}
     */
    function createMap() {
        return Object.create(null);
    }

    var OPERATORS = createMap();
    '+ - * / % === !== == != < > <= >= && || ! = |'.split(' ').map(function(operator) { OPERATORS[operator] = true; });
    var ESCAPE = {'n':'\n', 'f':'\f', 'r':'\r', 't':'\t', 'v':'\v', '\'':'\'', '"':'"'};

    /**
     * @constructor
     */
    var Lexer = function Lexer(options) {
        this.options = options;
    };

    Lexer.prototype = {
        constructor: Lexer,

        lex: function(text) {
            this.text = text;
            this.index = 0;
            this.tokens = [];

            while (this.index < this.text.length) {
                var ch = this.text.charAt(this.index);
                if (ch === '"' || ch === '\'') {
                    this.readString(ch);
                } else if (this.isNumber(ch) || ch === '.' && this.isNumber(this.peek())) {
                    this.readNumber();
                } else if (this.isIdentifierStart(this.peekMultichar())) {
                    this.readIdent();
                } else if (this.is(ch, '(){}[].,;:?')) {
                    this.tokens.push({index: this.index, text: ch});
                    this.index++;
                } else if (this.isWhitespace(ch)) {
                    this.index++;
                } else {
                    var ch2 = ch + this.peek();
                    var ch3 = ch2 + this.peek(2);
                    var op1 = OPERATORS[ch];
                    var op2 = OPERATORS[ch2];
                    var op3 = OPERATORS[ch3];
                    if (op1 || op2 || op3) {
                        var token = op3 ? ch3 : (op2 ? ch2 : ch);
                        this.tokens.push({index: this.index, text: token, operator: true});
                        this.index += token.length;
                    } else {
                        this.throwError('Unexpected next character ', this.index, this.index + 1);
                    }
                }
            }
            return this.tokens;
        },

        is: function(ch, chars) {
            return chars.indexOf(ch) !== -1;
        },

        peek: function(i) {
            var num = i || 1;
            return (this.index + num < this.text.length) ? this.text.charAt(this.index + num) : false;
        },

        isNumber: function(ch) {
            return ('0' <= ch && ch <= '9') && typeof ch === 'string';
        },

        isWhitespace: function(ch) {
            // IE treats non-breaking space as \u00A0
            return (ch === ' ' || ch === '\r' || ch === '\t' ||
                ch === '\n' || ch === '\v' || ch === '\u00A0');
        },

        isIdentifierStart: function(ch) {
            return this.options.isIdentifierStart ?
                this.options.isIdentifierStart(ch, this.codePointAt(ch)) :
                this.isValidIdentifierStart(ch);
        },

        isValidIdentifierStart: function(ch) {
            return ('a' <= ch && ch <= 'z' ||
                'A' <= ch && ch <= 'Z' ||
                '_' === ch || ch === '$');
        },

        isIdentifierContinue: function(ch) {
            return this.options.isIdentifierContinue ?
                this.options.isIdentifierContinue(ch, this.codePointAt(ch)) :
                this.isValidIdentifierContinue(ch);
        },

        isValidIdentifierContinue: function(ch, cp) {
            return this.isValidIdentifierStart(ch, cp) || this.isNumber(ch);
        },

        codePointAt: function(ch) {
            if (ch.length === 1) return ch.charCodeAt(0);
            // eslint-disable-next-line no-bitwise
            return (ch.charCodeAt(0) << 10) + ch.charCodeAt(1) - 0x35FDC00;
        },

        peekMultichar: function() {
            var ch = this.text.charAt(this.index);
            var peek = this.peek();
            if (!peek) {
                return ch;
            }
            var cp1 = ch.charCodeAt(0);
            var cp2 = peek.charCodeAt(0);
            if (cp1 >= 0xD800 && cp1 <= 0xDBFF && cp2 >= 0xDC00 && cp2 <= 0xDFFF) {
                return ch + peek;
            }
            return ch;
        },

        isExpOperator: function(ch) {
            return (ch === '-' || ch === '+' || this.isNumber(ch));
        },

        throwError: function(error, start, end) {
            end = end || this.index;
            var colStr = (isDefined(start)
                ? 's ' + start +  '-' + this.index + ' [' + this.text.substring(start, end) + ']'
                : ' ' + end);
            throw $parseMinErr('lexerr', 'Lexer Error: {0} at column{1} in expression [{2}].',
                error, colStr, this.text);
        },

        readNumber: function() {
            var number = '';
            var start = this.index;
            while (this.index < this.text.length) {
                var ch = lowercase(this.text.charAt(this.index));
                if (ch === '.' || this.isNumber(ch)) {
                    number += ch;
                } else {
                    var peekCh = this.peek();
                    if (ch === 'e' && this.isExpOperator(peekCh)) {
                        number += ch;
                    } else if (this.isExpOperator(ch) &&
                        peekCh && this.isNumber(peekCh) &&
                        number.charAt(number.length - 1) === 'e') {
                        number += ch;
                    } else if (this.isExpOperator(ch) &&
                        (!peekCh || !this.isNumber(peekCh)) &&
                        number.charAt(number.length - 1) === 'e') {
                        this.throwError('Invalid exponent');
                    } else {
                        break;
                    }
                }
                this.index++;
            }
            this.tokens.push({
                index: start,
                text: number,
                constant: true,
                value: Number(number)
            });
        },

        readIdent: function() {
            var start = this.index;
            this.index += this.peekMultichar().length;
            while (this.index < this.text.length) {
                var ch = this.peekMultichar();
                if (!this.isIdentifierContinue(ch)) {
                    break;
                }
                this.index += ch.length;
            }
            this.tokens.push({
                index: start,
                text: this.text.slice(start, this.index),
                identifier: true
            });
        },

        readString: function(quote) {
            var start = this.index;
            this.index++;
            var string = '';
            var rawString = quote;
            var escape = false;
            while (this.index < this.text.length) {
                var ch = this.text.charAt(this.index);
                rawString += ch;
                if (escape) {
                    if (ch === 'u') {
                        var hex = this.text.substring(this.index + 1, this.index + 5);
                        if (!hex.match(/[\da-f]{4}/i)) {
                            this.throwError('Invalid unicode escape [\\u' + hex + ']');
                        }
                        this.index += 4;
                        string += String.fromCharCode(parseInt(hex, 16));
                    } else {
                        var rep = ESCAPE[ch];
                        string = string + (rep || ch);
                    }
                    escape = false;
                } else if (ch === '\\') {
                    escape = true;
                } else if (ch === quote) {
                    this.index++;
                    this.tokens.push({
                        index: start,
                        text: rawString,
                        constant: true,
                        value: string
                    });
                    return;
                } else {
                    string += ch;
                }
                this.index++;
            }
            this.throwError('Unterminated quote', start);
        }
    };

    var opt = {
        csp: false,
        literals: {
            'true': true,
            'false': false,
            'null': null,
            'undefined': undefined
        },
        isIdentifierStart: false,
        isIdentifierContinue: false
    };

    var lex = new Lexer(opt);
    /**
     * Make a map and return a function for checking if a key
     * is in that map.
     */
    function makeMap (
        str,
        expectsLowerCase
    ) {
        var map = Object.create(null);
        var list = str.split(',');
        for (var i = 0; i < list.length; i++) {
            map[list[i]] = true;
        }
        return expectsLowerCase
            ? function (val) { return map[val.toLowerCase()]; }
            : function (val) { return map[val]; }
    }

    // Special Elements (can contain anything)
    var isPlainTextElement = makeMap('script,style,textarea', true);
    var isTemplateDirNames = makeMap('ve:for', true);

    function isTemplateDirective (attributes) {
        return Array.prototype.some.call(attributes || [], function(e) { return isTemplateDirNames(e.name) });
    }

    var cacheExpressions = new Cache();
    function createFunction (expression) {
        var fn = cacheExpressions.get(expression),
            lexerTokens,
            fnBody = '',
            fnVars,
            fnVarsArr = [];

        if (fn) {
            return function (context, localContext) {
                return fn.call(context, localContext || {});
            }
        }

        lexerTokens = lex.lex(expression);

        for (var i = 0; i < lexerTokens.length; i++) {
            if (
                lexerTokens[i].identifier === true
                && (lexerTokens[i-1] && lexerTokens[i-1].text !== '.' || !lexerTokens[i-1])
                && (lexerTokens[i+1] && lexerTokens[i+1].text !== ':' || !lexerTokens[i+1])
                && (lexerTokens[i+1] && lexerTokens[i+1].text !== '(' || !lexerTokens[i+1])
            ) {
                fnVarsArr.push('v' + fnVarsArr.length);
                fnBody += 'if("' + lexerTokens[i].text + '" in l){v'+[fnVarsArr.length-1] + '=l.' + lexerTokens[i].text +
                    ';}else if("' + lexerTokens[i].text + '" in this){v'+[fnVarsArr.length - 1] + '=' + lexerTokens[i].text +
                    ';}else{v'+[fnVarsArr.length - 1] + '=undefined;}';
                //expression = expression.replace(new RegExp(lexerTokens[i].text + '\\b'), fnVarsArr[fnVarsArr.length-1]);
                lexerTokens[i].text = fnVarsArr[fnVarsArr.length - 1];
            }
        }

        fnBody += ' return ';
        for (var i = 0; i < lexerTokens.length; i++) {
            fnBody += lexerTokens[i].text;
        }

        try {
            fnVars = fnVarsArr.length ? 'var ' + fnVarsArr.join(',') + ';' : '';
            fn = new Function('l', 'with(this){'  + fnVars + fnBody + ';}');// + 'return ' + expression + ';}');
            console.info('with(this){'  + fnVars + fnBody + ';}');
        } catch (ex) {
            console.warn(ex, 'with(this){'  + fnVars + fnBody + ';}');
            fn = function () {}
        }

        cacheExpressions.set(expression, fn);

        return function (context, localContext) {
            return fn.call(context, localContext || {});
        }
    }

    function invokeExpression (expression, scope) {
        if (scope && scope[expression] && typeof scope[expression] === 'function') {
            return createFunction(expression + '()');
        }

        return createFunction(expression, scope);
    }

    function invokeFilter (name) {
        var filter = Ve.options.filters[name];
        return filter ? filter() : identifier
    }


    function ViewContainer (el, view) {
        this._view = view;
        this._el = el;
        this._clone = el.cloneNode(true);

        this._container = document.createComment('');
        this._el.parentNode.insertBefore(this._container, this._el);
    }

    ViewContainer.prototype = {
        insert: function () {
            return this._container.parentNode.insertBefore(this._el, this._container.nextSibling);
        },
        remove: function () {
            this._el.parentNode.removeChild(this._el);
        }
    };

    var ATTR_BIND_REGEXP = /\[attr.(.*)\]/;
    var PROP_BIND_REGEXP = /\[prop.(.*)\]/;

    function attributeBind (element, name, expression) {
        var fn = invokeExpression(expression);
        element.removeAttribute('[attr.' + name + ']');

        return function (localContext) {
            element.setAttribute(name, fn(this, localContext))
        }
    }

    var PREFIX_REGEXP = /^((?:x|data)[:\-_])/i;
    var SPECIAL_CHARS_REGEXP = /[\-_]+(.)/g;

    /**
     * Converts all accepted directives format into proper directive name.
     * @param name Name to normalize
     */
    function directiveNormalize(name) {
        return name
            .replace(PREFIX_REGEXP, '')
            .replace(SPECIAL_CHARS_REGEXP, function(_, letter, offset) {
                return offset ? letter.toUpperCase() : letter;
            });
    }

    function Ve (meta) {
        this.tree = [];

        /*var originEventListener = HTMLElement.prototype.addEventListener;
                HTMLElement.prototype.addEventListener = function (a, b, c) {

                originEventListener.call(this, a, function (event) {
                    b(event);
                    self.nextTick();
                }, c);
            }*/
    }

    var ASSET_TYPES = [
        'component',
        'directive',
        'filter'
    ];

    /**
     * Create asset registration methods.
     */
    function initAssetRegisters (Ve) {
        ASSET_TYPES.forEach(function (type) {
            Ve[type] = function (
                id,
                definition
            ) {
                if (!definition) {
                    return this.options[type + 's'][id]
                } else {

                    if (type === 'component' && isPlainObject(definition)) {
                        definition.name = definition.name || id;
                        definition = definition; //this.options._base.extend(definition);
                    }
                    if (type === 'directive' && typeof definition === 'function') {
                        definition = definition; //{ init: definition, update: definition };
                    }
                    this.options[type + 's'][id] = definition;
                    return definition
                }
            };
        });
    }

    initAssetRegisters(Ve);

    Ve.options = Object.create(null);
    ASSET_TYPES.forEach(function (type) {
        Ve.options[type + 's'] = Object.create(null);
    });

    // Destroy View
    function destroy (node) {
        for (var i = 0; i < node.view.children.length; i++) {
            destroy(node.view.children[i]);
        }

        for (var j in node.directives) {
            isFunction(node.directives[j].fn.destroy) &&
            node.directives[j].fn.destroy(node.directives[j].element);
            node.directives[j].state = 0;
        }
    }


    /**
     * Default directives
     */
    forEach(
        'click dblclick mousedown mouseup mouseover mouseout mousemove mouseenter mouseleave keydown keyup keypress submit focus blur copy cut paste'.split(' '),
        function(eventName) {
            var directiveName = directiveNormalize('ve:' + eventName);

            Ve.directive(directiveName, function () {
                var instance = this,
                    cb;

                return {
                    init: function (element, expression, view) {
                        var self = this,
                            localContext = view.localContext || {},
                            fn = invokeExpression(expression);

                        cb = function (event) {
                            localContext['$event'] = event;
                            fn(self, localContext);
                            instance.nextTick();
                        };

                        element.addEventListener(eventName, cb);
                    },
                    destroy: function (element) {
                        element.removeEventListener(eventName, cb);
                    }
                }
            });
        });

    Ve.directive('ve:class', function () {
        var changes = new DetectChanges(null);

        function classList (element, itemName, state) {
            var s = element.className || '';
            var list = s.split(/\s+/g);

            if (list[0] === '') {
                list.shift();
            }

            var index = list.indexOf(itemName);
            if (index < 0 && state) {
                list.push(itemName);
            }
            if (index >= 0 && !state) {
                list.splice(index, 1);
            }
            element.className = list.join(' ');
            return (index >= 0);
        }

        var updateElementClass = function (element, expression, view) {
            var elementClasses = invokeExpression(expression)(this, view.localContext);

            if (!changes.diff(elementClasses)) {
                return;
            }

            if (Array.isArray(elementClasses)) {
                forEach(elementClasses, function(classItem) {
                    if (typeof classItem === 'string') {
                        classList(element, classItem, true);
                    }
                    if (typeof classItem === 'object') {
                        forEach(classItem, function (state, name) {
                            classList(element, name, state);
                        });
                    }
                });
            }

            if (!Array.isArray(elementClasses) && typeof elementClasses === 'object') {
                forEach(elementClasses, function (state, name) {
                    classList(element, name, state);
                });
            }
        };

        return {
            init: updateElementClass,
            update: updateElementClass
        }
    });

    Ve.directive('ve:style', function () {
        var updateElementStyles = function (element, expression, view) {
            var elementClasses = invokeExpression(expression)(this, view.localContext);


            if (!Array.isArray(elementClasses) && typeof elementClasses === 'object') {
                forEach(elementClasses, function (state, name) {
                    element.style[name] = state;
                });
            }
        };

        return {
            init: updateElementStyles,
            update: updateElementStyles
        }
    });

    Ve.directive('ve:if', function () {
        var /** @type {ViewContainer} */ viewContainer,
            /** @type {boolean} */ removed = false,
            /** @type {Function} */ ifStatement;

        return {
            init: function (element, expression) {
                ifStatement = invokeExpression(expression);

                viewContainer = new ViewContainer(element);

                if (!ifStatement(this)) {
                    removed = true;
                    viewContainer.remove();
                }
            },
            update: function () {
                var state = ifStatement(this);

                if (!state && !removed) {
                    removed = true;
                    viewContainer.remove();
                }

                if (state && removed) {
                    removed = false;
                    viewContainer.insert();
                }
            }
        }
    });

    Ve.directive('ve:model', function () {
        var instance = this;

        function elementValue(element, modelValue) {
            switch(element.type) {
                case 'checkbox':
                    if( typeof modelValue!=='undefined' ) {
                        element.checked = !!modelValue;
                    }
                    return !!element.checked;
                case 'radio':
                    if (!isUndef(modelValue)) {
                        element.checked = (modelValue === element.value);
                    }
                    return element.checked ? element.value:false;
                case 'select-one':
                    if (modelValue) {
                        for(var i = 0; i < element.options.length; i++) {
                            element.options[i].selected = (modelValue === element.options[i].value);
                        }
                    }
                    return trim(element.value);
                case 'select-multiple':
                    if (modelValue && Array.isArray(modelValue)) {
                        for (var i = 0; i < element.options.length; i++) {
                            element.options[i].selected = (modelValue.indexOf(element.options[i].value) !== -1);
                        }
                    }

                    return [].slice.call(element.selectedOptions).map(function (sel) {
                        return sel.value;
                    });
                default:
                    if (isDef(modelValue)) {
                        element.value = modelValue;
                    }
                    return element.value; // trim(element.value);
            }
        }

        var listenerCb = function (expression, event) {
            var key = event.keyCode;

            invokeExpression(expression + ' = "' + elementValue(event.target) + '"')(this);

            //ignore command, modifiers, arrows
            if (key === 91 || (15 < key && key < 19) || (37 <= key && key <= 40)) return;

            instance.nextTick();
        };

        return {
            init: function (element, expression) {
                var modelValue = invokeExpression(expression)(this);
                var msie = parseInt((/msie (\d+)/.exec(lowercase(navigator.userAgent)) || [])[1]);

                listenerCb = listenerCb.bind(this, expression);

                if (!isUndef(modelValue)) {
                    elementValue(element, modelValue);
                }

                // if the browser does support "input" event, we are fine - except on IE9 which doesn't fire the
                // input event on backspace, delete or cut
                if (msie === 9) {
                    element.addEventListener('input', listenerCb);
                }
                else {
                    element.addEventListener('keyup', listenerCb);
                }

                // if user paste into input using mouse, we need "change" event to catch it
                element.addEventListener('change', listenerCb);
            },
            update: function (element, expression) {
                var value = invokeExpression(expression)(this);
                elementValue(element, value);
            },
            destroy: function (element) {
                element.removeEventListener('input', listenerCb);
                element.removeEventListener('keyup', listenerCb);
                element.removeEventListener('change', listenerCb);
            }
        }
    });

    Ve.directive('ve:for', function () {
        var instance = this,
            originElement,
            elementAnchor,
            exp,
            filterName,
            filterArgs,
            filter,
            trackBy,
            alias,
            aliasAs,
            collectionName,
            collection;

        var lastBlockMap = Object.create(null);
        var lastBlockOrder = [];

        function listUpdate (collection, view) {
            var fragment = document.createDocumentFragment(),
                collectionLength = 0,
                nextBlockOrder = new Array(collectionLength),
                nextBlockMap = Object.create(null),
                block,
                index;

            collection = filter.apply(null, [collection].concat(filterArgs));
            collectionLength = collection.length;

            if (aliasAs) {
                this[aliasAs]  = filter.apply(null, [collection].concat(filterArgs));
            }

            // locate existing items from collection list
            for (index = 0; index < collectionLength; index++) {
                var key = index;
                var value = collection[key];
                var orderChanged = false;
                var trackById = trackBy !== false ? (typeof value[trackBy] === 'undefined' ? index : value[trackBy]) : index;

                if (lastBlockMap[trackById]) {
                    // found previously seen block
                    block = lastBlockMap[trackById];
                    delete lastBlockMap[trackById];
                    nextBlockMap[trackById] = block;
                    nextBlockOrder[index] = block;
                } else if (nextBlockMap[trackById]) {
                    // if detect duplication restore prev and throw error
                    forEach(nextBlockOrder, function(block) {
                        if (block && block.context) lastBlockMap[block.id] = block;
                    });
                    throw new Error('dupes',
                        'Duplicates in a repeater are not allowed. Use \'track by\' expression to specify unique keys. Repeater: {0}, Duplicate key: {1}, Duplicate value: {2}',
                        exp, trackById, value);
                } else {
                    nextBlockOrder[index] = {
                        id: trackById,
                        context: undefined,
                        view: undefined
                    };
                    nextBlockMap[trackById] = true;
                }

                if (lastBlockOrder[index] !== nextBlockOrder[index]) {
                    orderChanged = true;
                }
            }

            // remove leftover items in lastBlockMap
            for (var blockKey in lastBlockMap) {
                block = lastBlockMap[blockKey];
                destroy(block.view);
                fragment.appendChild(block.view.element);
            }

            while (fragment.firstChild) {
                fragment.firstChild.remove();
            }

            for (index = 0; index < collectionLength; index++) {
                key = index;
                value = collection[key];
                block = nextBlockOrder[index];

                if (block.context) {
                    // if we have already seen this object, then we need to reuse the
                    // associated scope/element
                    orderChanged && fragment.appendChild(block.view.element);
                } else {
                    // new item which we don't know about
                    var clone = originElement.cloneNode(true);

                    nextBlockMap[block.id] = block;
                    nextBlockMap[block.id].context = new ForContext(value, collection, index, collection.length);
                    nextBlockMap[block.id].context[alias] = value;

                    nextBlockMap[block.id].view = instance.bootstrap(clone, view.parent, nextBlockMap[block.id].context);

                    if (fragment.children.length) {
                        fragment.appendChild(clone);
                    }
                    else {
                        elementAnchor.parentNode.insertBefore(clone, elementAnchor.parentNode.lastChild.nextSibling);
                    }
                }
            }

            elementAnchor.parentNode.appendChild(fragment);
            lastBlockMap = nextBlockMap;
            lastBlockOrder = nextBlockOrder;
        }

        var ForContext = /** @class */ (function () {
            function ForContext($implicit, forOf, index, count) {
                this.$implicit = $implicit;
                this.forOf = forOf;
                this.index = index;
                this.count = count;
            }
            Object.defineProperty(ForContext.prototype, "first", {
                get: function () { return this.index === 0; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ForContext.prototype, "last", {
                get: function () { return this.index === this.count - 1; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ForContext.prototype, "even", {
                get: function () { return this.index % 2 === 0; },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ForContext.prototype, "odd", {
                get: function () { return !this.even; },
                enumerable: true,
                configurable: true
            });
            return ForContext;
        }());

        return {
            init: function (element, expression, view) {
                var self = this;

                exp = expression;
                match = exp.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

                if (!match) {
                    throw 'Expected expression in form of \'' + alias + ' in '+ collectionName + '[ track by _id_]\' but got \'' + exp + '\'.';
                }

                var lhs = match[1];
                var rhs = match[2];
                var trackByExp = match[4];
                var filterSrt = '';

                match = lhs.match(/^(?:(\s*[$\w]+)|\(\s*([$\w]+)\s*,\s*([$\w]+)\s*\))$/);

                if (!match) {
                    throw new Error('iidexp', '\'_item_\' in \'_item_ in _collection_\' should be an identifier or \'(_key_, _value_)\' expression, but got \'{0}\'.',
                        lhs);
                }

                trackBy = trackByExp;
                alias = lhs;
                aliasAs = match[3];
                collectionName = trim(rhs.split('|')[0]);
                collection =this[collectionName] || [];

                filterStr = trim(rhs.split('|')[1] || '');
                filterName = filterStr && filterStr.split(':')[0];
                filterArgs = (filterStr && filterStr.split(':').slice(1)) || [];
                filter = invokeFilter(filterName);

                elementAnchor = document.createComment('ve:for');
                originElement = element.cloneNode(true);

                element.parentNode.insertBefore(elementAnchor, element);
                element.parentNode.removeChild(element);

                listUpdate(collection, view);
            },
            update: function (element, expression, view) {
                listUpdate(this[collectionName], view);
            }
        }
    });

    /**
     *
     * Default Filters
     *  - slice
     *  - json
     * 	- lowercase
     * 	- uppercase
     */

    Ve.filter('lowercase', function () {
        return function (value) {
            if (typeof value !== 'string') {
                return value;
            }
            return value.toLowerCase();
        }
    });

    Ve.filter('uppercase', function () {
        return function (value) {
            if (typeof value !== 'string') {
                return value;
            }
            return value.toUpperCase();
        }
    });

    Ve.filter('json', function () {
        return function (value) {
            return JSON.stringify(value);
        }
    });

    Ve.filter('slice', function () {
        return function (value, begin, end) {
            if (!isArray(value)) {
                return value;
            }
            return value.slice(begin, end);
        }
    });

    Ve.prototype = {
        bootstrap: function (node, parent, localContext) {
            var children,
                len,
                parent = parent || null;

            parent = this.createView(node, parent, localContext);
            children = node.childNodes;
            len = children.length;

            if (parent.viewContainer) {
                return;
            }

            for (var i = 0; i < len; i++) {
                this.bootstrap(children[i], parent, localContext);
            }

            return parent;
        },
        init: function (nodes) {
            this.bootstrapped = true;

            function map (nodes) {
                for (var i = 0; i < nodes.length; i++) {

                    if (nodes[i].view.children.length) {
                        map(nodes[i].view.children, nodes[i].context);
                    }

                    for (var j in nodes[i].directives) {
                        nodes[i].directives[j].fn.init.call(
                            nodes[i].isComponent ? nodes[i].parent.context : nodes[i].context,
                            nodes[i].directives[j].element,
                            nodes[i].directives[j].expression,
                            nodes[i]
                        );

                        nodes[i].directives[j].state = 1;
                    }

                    for (var g in nodes[i].bindings) {
                        nodes[i].bindings[g].call(
                            nodes[i].isComponent ? nodes[i].parent.context : nodes[i].context,
                            nodes[i].localContext || {}
                        );
                    }
                }
            }

            map(nodes || this.tree);
            this.init = true;
        },

        nextTick: function (nodes) {
            function map (nodes) {
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].view.children.length) {
                        map(nodes[i].view.children, nodes[i].context);
                    }

                    for (var j in nodes[i].directives) {
                        var execFn = nodes[i].directives[j].state ? 'update':'init';

                        nodes[i].directives[j].fn[execFn] && nodes[i].directives[j].fn[execFn].call(
                            nodes[i].isComponent ? nodes[i].parent.context : nodes[i].context,
                            nodes[i].directives[j].element,
                            nodes[i].directives[j].expression,
                            nodes[i]
                        );

                        nodes[i].directives[j].state = 1;
                    }

                    for (var g in nodes[i].bindings) {
                        nodes[i].bindings[g].call(
                            nodes[i].isComponent ? nodes[i].parent.context : nodes[i].context,
                            nodes[i].localContext || {}
                        );
                    }
                }
            }

            map(nodes || this.tree);
        },

        interpolations: function (textElement, view) {
            var clone = textElement.cloneNode(true);
            var interpolationTokens = textElement.textContent.match(/\{\{(.*?)\}\}/g);

            if (interpolationTokens) {

                function interpolate (locals) {
                    var self = this;

                    var textContent = clone.textContent.replace(/\{\{(.*?)\}\}/g, function (match, x, offset, string) {
                        var exp = x.replace(/\s/g, '').split('|');
                        var path = trim(exp[0]).split('.');
                        var filter = (exp[1] && invokeFilter(trim(exp[1]))) || identifier;
                        var val;

                        for (var n in path) {
                            try {
                                val = (val && val[path[n]]);
                                val = isUndef(val) ? (self[path[n]] || locals[path[n]]): val;
                            }
                            catch (ex) {
                                val = null;
                                console.error(clone.textContent)
                            }
                        }

                        return isUndef(val) ? '' : (filter ? filter(val) : val);
                    });

                    if (textElement.textContent !== textContent) {
                        textElement.textContent = textContent;
                    }
                }

                view.directives.push({
                    element: textElement,
                    expression: textElement.textContent,
                    fn: {
                        init: function (element, expression, view) {
                            interpolate.call(this, view.localContext)
                        },
                        update: function (element, expression, view) {
                            interpolate.call(this, view.localContext)
                        }
                    }
                });
            }

            return false;
        },

        createView: function (element, parent, localContext) {
            var self = this;
            var component;
            var contentProjectionElement;
            var viewContent;
            var view = {
                component: (parent && parent.cmp) || {},
                context: parent && (parent.context || parent.cmp || {}),
                localContext: localContext || {},
                name: (element.tagName || '').toLocaleLowerCase(),
                element: element,
                parent: parent,
                content: {
                    children: []
                },
                view: {
                    children: []
                },
                type: element.nodeType,
                attrs: Array.prototype.slice.call(element.attributes || []),
                directives: [],
                bindings: [],
                index: parent ? parent.view.children.length : 0,
                viewContainer: isTemplateDirective(element.attributes)
            };

            if (Ve.options.components[view.name]) {
                component = Ve.options.components[view.name];

                var ComponentContext = (function ComponentContext() {
                    function ComponentContext (data) {
                        Object.assign(this, data);
                    }
                    return ComponentContext;
                }());

                ComponentContext.prototype = Object.create(component.methods);

                view.isComponent = true;
                view.component = component;
                view.context = new ComponentContext(component.data);
                view.template = component.template;

                viewContent = view.element.innerHTML;
                element.innerHTML = component.template;

                contentProjectionElement = element.querySelector('[ve-content]');
                if (contentProjectionElement) {
                    // TODO: bootstrap view then bootstrap content !???
                    //	this.bootstrap(viewContent, contentProjectionElement);
                }

                for (var j = 0; j < view.attrs.length; j++) {
                    var attr = view.attrs[j];
                    if (attr.name.match(PROP_BIND_REGEXP) && !view.viewContainer) {
                        var attrName = attr.name.match(PROP_BIND_REGEXP)[1];
                        element.removeAttribute('[prop.' + attrName + ']');

                        view.bindings.push((function(propName, value) {
                            var fn = invokeExpression(value);

                            return function (localContext) {
                                // TODO: Compare new and old value
                                view.context[propName] = fn(this, localContext);
                            }
                        })(attrName, attr.value));

                        view.bindings[view.bindings.length-1].call(view.parent.context, localContext);
                    }
                }
            }

            if (element.nodeType === 1 || element.nodeType === 9) {
                for (var j = 0; j < view.attrs.length; j++) {
                    var attr = view.attrs[j];

                    if (Ve.options.directives[directiveNormalize(attr.name)]) {
                        if (!view.viewContainer || isTemplateDirective([attr])) {
                            view.directives.push({
                                fn: Ve.options.directives[directiveNormalize(attr.name)].call(this),
                                element: element,
                                expression: attr.value,
                                view: view
                            });

                            view.element.removeAttribute(attr.name);
                        }
                        else {
                            element.setAttribute(attr.name, attr.value);
                        }
                    }
                }

                for (var j = 0; j < view.attrs.length; j++) {
                    var attr = view.attrs[j];

                    if (attr.name.match(ATTR_BIND_REGEXP) && !view.viewContainer) {
                        view.bindings.push(
                            attributeBind(element, attr.name.match(ATTR_BIND_REGEXP)[1], attr.value)
                        );
                    }
                }

                if (view.viewContainer) {
                    view.element = document.createComment('ve:for');
                    view.name = 'comment';
                    view.type = view.element.nodeType;
                }
            }

            if (view.type === 3) {
                var interpolationDir = this.interpolations(element, view);
                interpolationDir && view.directives.push(interpolationDir);
            }

            if (parent && parent.view) {
                parent.view.children.push(view);
            }
            else {
                this.tree.push(view);
            }

            return view;
        }
    };

    if ( typeof module != 'undefined' && module.exports ) {
        module.exports = Ve;
    } else {
        window.Ve = Ve;
    }

})(window, document);
