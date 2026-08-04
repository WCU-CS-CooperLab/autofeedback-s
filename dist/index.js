import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 412:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* module decorator */ module = __nccwpck_require__.nmd(module);


const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert === undefined) {
		colorConvert = __nccwpck_require__(185);
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});


/***/ }),

/***/ 465:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const ansiStyles = __nccwpck_require__(412);
const {stdout: stdoutColor, stderr: stderrColor} = __nccwpck_require__(450);
const {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
} = __nccwpck_require__(809);

const {isArray} = Array;

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m'
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

class ChalkClass {
	constructor(options) {
		// eslint-disable-next-line no-constructor-return
		return chalkFactory(options);
	}
}

const chalkFactory = options => {
	const chalk = {};
	applyOptions(chalk, options);

	chalk.template = (...arguments_) => chalkTag(chalk.template, ...arguments_);

	Object.setPrototypeOf(chalk, Chalk.prototype);
	Object.setPrototypeOf(chalk.template, chalk);

	chalk.template.constructor = () => {
		throw new Error('`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.');
	};

	chalk.template.Instance = ChalkClass;

	return chalk.template;
};

function Chalk(options) {
	return chalkFactory(options);
}

for (const [styleName, style] of Object.entries(ansiStyles)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this._styler), this._isEmpty);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		}
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this._styler, true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	}
};

const usedModels = ['rgb', 'hex', 'keyword', 'hsl', 'hsv', 'hwb', 'ansi', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.color[levelMapping[level]][model](...arguments_), ansiStyles.color.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

for (const model of usedModels) {
	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.bgColor[levelMapping[level]][model](...arguments_), ansiStyles.bgColor.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this._generator.level;
		},
		set(level) {
			this._generator.level = level;
		}
	}
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	const builder = (...arguments_) => {
		if (isArray(arguments_[0]) && isArray(arguments_[0].raw)) {
			// Called as a template literal, for example: chalk.red`2 + 3 = {bold ${2+3}}`
			return applyStyle(builder, chalkTag(builder, ...arguments_));
		}

		// Single argument is hot path, implicit coercion is faster than anything
		// eslint-disable-next-line no-implicit-coercion
		return applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));
	};

	// We alter the prototype because we must return a function, but there is
	// no way to create a function with a different prototype
	Object.setPrototypeOf(builder, proto);

	builder._generator = self;
	builder._styler = _styler;
	builder._isEmpty = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self._isEmpty ? '' : string;
	}

	let styler = self._styler;

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.indexOf('\u001B') !== -1) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

let template;
const chalkTag = (chalk, ...strings) => {
	const [firstString] = strings;

	if (!isArray(firstString) || !isArray(firstString.raw)) {
		// If chalk() was called by itself or with a string,
		// return the string itself as a string.
		return strings.join(' ');
	}

	const arguments_ = strings.slice(1);
	const parts = [firstString.raw[0]];

	for (let i = 1; i < firstString.length; i++) {
		parts.push(
			String(arguments_[i - 1]).replace(/[{}\\]/g, '\\$&'),
			String(firstString.raw[i])
		);
	}

	if (template === undefined) {
		template = __nccwpck_require__(670);
	}

	return template(chalk, parts.join(''));
};

Object.defineProperties(Chalk.prototype, styles);

const chalk = Chalk(); // eslint-disable-line new-cap
chalk.supportsColor = stdoutColor;
chalk.stderr = Chalk({level: stderrColor ? stderrColor.level : 0}); // eslint-disable-line new-cap
chalk.stderr.supportsColor = stderrColor;

module.exports = chalk;


/***/ }),

/***/ 670:
/***/ ((module) => {


const TEMPLATE_REGEX = /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi;

const ESCAPES = new Map([
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['b', '\b'],
	['f', '\f'],
	['v', '\v'],
	['0', '\0'],
	['\\', '\\'],
	['e', '\u001B'],
	['a', '\u0007']
]);

function unescape(c) {
	const u = c[0] === 'u';
	const bracket = c[1] === '{';

	if ((u && !bracket && c.length === 5) || (c[0] === 'x' && c.length === 3)) {
		return String.fromCharCode(parseInt(c.slice(1), 16));
	}

	if (u && bracket) {
		return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
	}

	return ESCAPES.get(c) || c;
}

function parseArguments(name, arguments_) {
	const results = [];
	const chunks = arguments_.trim().split(/\s*,\s*/g);
	let matches;

	for (const chunk of chunks) {
		const number = Number(chunk);
		if (!Number.isNaN(number)) {
			results.push(number);
		} else if ((matches = chunk.match(STRING_REGEX))) {
			results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, character) => escape ? unescape(escape) : character));
		} else {
			throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
		}
	}

	return results;
}

function parseStyle(style) {
	STYLE_REGEX.lastIndex = 0;

	const results = [];
	let matches;

	while ((matches = STYLE_REGEX.exec(style)) !== null) {
		const name = matches[1];

		if (matches[2]) {
			const args = parseArguments(name, matches[2]);
			results.push([name].concat(args));
		} else {
			results.push([name]);
		}
	}

	return results;
}

function buildStyle(chalk, styles) {
	const enabled = {};

	for (const layer of styles) {
		for (const style of layer.styles) {
			enabled[style[0]] = layer.inverse ? null : style.slice(1);
		}
	}

	let current = chalk;
	for (const [styleName, styles] of Object.entries(enabled)) {
		if (!Array.isArray(styles)) {
			continue;
		}

		if (!(styleName in current)) {
			throw new Error(`Unknown Chalk style: ${styleName}`);
		}

		current = styles.length > 0 ? current[styleName](...styles) : current[styleName];
	}

	return current;
}

module.exports = (chalk, temporary) => {
	const styles = [];
	const chunks = [];
	let chunk = [];

	// eslint-disable-next-line max-params
	temporary.replace(TEMPLATE_REGEX, (m, escapeCharacter, inverse, style, close, character) => {
		if (escapeCharacter) {
			chunk.push(unescape(escapeCharacter));
		} else if (style) {
			const string = chunk.join('');
			chunk = [];
			chunks.push(styles.length === 0 ? string : buildStyle(chalk, styles)(string));
			styles.push({inverse, styles: parseStyle(style)});
		} else if (close) {
			if (styles.length === 0) {
				throw new Error('Found extraneous } in Chalk template literal');
			}

			chunks.push(buildStyle(chalk, styles)(chunk.join('')));
			chunk = [];
			styles.pop();
		} else {
			chunk.push(character);
		}
	});

	chunks.push(chunk.join(''));

	if (styles.length > 0) {
		const errMessage = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? '' : 's'} (\`}\`)`;
		throw new Error(errMessage);
	}

	return chunks.join('');
};


/***/ }),

/***/ 809:
/***/ ((module) => {



const stringReplaceAll = (string, substring, replacer) => {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.substr(endIndex, index - endIndex) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

const stringEncaseCRLFWithFirstIndex = (string, prefix, postfix, index) => {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

module.exports = {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
};


/***/ }),

/***/ 872:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* MIT license */
/* eslint-disable no-mixed-operators */
const cssKeywords = __nccwpck_require__(953);

// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

const reverseKeywords = {};
for (const key of Object.keys(cssKeywords)) {
	reverseKeywords[cssKeywords[key]] = key;
}

const convert = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

module.exports = convert;

// Hide .channels and .labels properties
for (const model of Object.keys(convert)) {
	if (!('channels' in convert[model])) {
		throw new Error('missing channels property: ' + model);
	}

	if (!('labels' in convert[model])) {
		throw new Error('missing channel labels property: ' + model);
	}

	if (convert[model].labels.length !== convert[model].channels) {
		throw new Error('channel and label counts mismatch: ' + model);
	}

	const {channels, labels} = convert[model];
	delete convert[model].channels;
	delete convert[model].labels;
	Object.defineProperty(convert[model], 'channels', {value: channels});
	Object.defineProperty(convert[model], 'labels', {value: labels});
}

convert.rgb.hsl = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	const delta = max - min;
	let h;
	let s;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	const l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	let rdif;
	let gdif;
	let bdif;
	let h;
	let s;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const v = Math.max(r, g, b);
	const diff = v - Math.min(r, g, b);
	const diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = 0;
		s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}

		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert.rgb.hwb = function (rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;

	const k = Math.min(1 - r, 1 - g, 1 - b);
	const c = (1 - r - k) / (1 - k) || 0;
	const m = (1 - g - k) / (1 - k) || 0;
	const y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
	/*
		See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	*/
	return (
		((x[0] - y[0]) ** 2) +
		((x[1] - y[1]) ** 2) +
		((x[2] - y[2]) ** 2)
	);
}

convert.rgb.keyword = function (rgb) {
	const reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	let currentClosestDistance = Infinity;
	let currentClosestKeyword;

	for (const keyword of Object.keys(cssKeywords)) {
		const value = cssKeywords[keyword];

		// Compute comparative distance
		const distance = comparativeDistance(rgb, value);

		// Check if its less, if so set as closest
		if (distance < currentClosestDistance) {
			currentClosestDistance = distance;
			currentClosestKeyword = keyword;
		}
	}

	return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
	return cssKeywords[keyword];
};

convert.rgb.xyz = function (rgb) {
	let r = rgb[0] / 255;
	let g = rgb[1] / 255;
	let b = rgb[2] / 255;

	// Assume sRGB
	r = r > 0.04045 ? (((r + 0.055) / 1.055) ** 2.4) : (r / 12.92);
	g = g > 0.04045 ? (((g + 0.055) / 1.055) ** 2.4) : (g / 12.92);
	b = b > 0.04045 ? (((b + 0.055) / 1.055) ** 2.4) : (b / 12.92);

	const x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	const y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	const z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	const xyz = convert.rgb.xyz(rgb);
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	const h = hsl[0] / 360;
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;
	let t2;
	let t3;
	let val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	const t1 = 2 * l - t2;

	const rgb = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}

		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	const h = hsl[0];
	let s = hsl[1] / 100;
	let l = hsl[2] / 100;
	let smin = s;
	const lmin = Math.max(l, 0.01);

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	const v = (l + s) / 2;
	const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	const h = hsv[0] / 60;
	const s = hsv[1] / 100;
	let v = hsv[2] / 100;
	const hi = Math.floor(h) % 6;

	const f = h - Math.floor(h);
	const p = 255 * v * (1 - s);
	const q = 255 * v * (1 - (s * f));
	const t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	const h = hsv[0];
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;
	const vmin = Math.max(v, 0.01);
	let sl;
	let l;

	l = (2 - s) * v;
	const lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); // Linear interpolation

	let r;
	let g;
	let b;
	/* eslint-disable max-statements-per-line,no-multi-spaces */
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}
	/* eslint-enable max-statements-per-line,no-multi-spaces */

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	const c = cmyk[0] / 100;
	const m = cmyk[1] / 100;
	const y = cmyk[2] / 100;
	const k = cmyk[3] / 100;

	const r = 1 - Math.min(1, c * (1 - k) + k);
	const g = 1 - Math.min(1, m * (1 - k) + k);
	const b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	const x = xyz[0] / 100;
	const y = xyz[1] / 100;
	const z = xyz[2] / 100;
	let r;
	let g;
	let b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// Assume sRGB
	r = r > 0.0031308
		? ((1.055 * (r ** (1.0 / 2.4))) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * (g ** (1.0 / 2.4))) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * (b ** (1.0 / 2.4))) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let x;
	let y;
	let z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	const y2 = y ** 3;
	const x2 = x ** 3;
	const z2 = z ** 3;
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let h;

	const hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	const c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	const l = lch[0];
	const c = lch[1];
	const h = lch[2];

	const hr = h / 360 * 2 * Math.PI;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args, saturation = null) {
	const [r, g, b] = args;
	let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	let ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// Optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	const r = args[0];
	const g = args[1];
	const b = args[2];

	// We use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	const ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	let color = args % 10;

	// Handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	const mult = (~~(args > 50) + 1) * 0.5;
	const r = ((color & 1) * mult) * 255;
	const g = (((color >> 1) & 1) * mult) * 255;
	const b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// Handle greyscale
	if (args >= 232) {
		const c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	let rem;
	const r = Math.floor(args / 36) / 5 * 255;
	const g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	const b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	const integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	let colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(char => {
			return char + char;
		}).join('');
	}

	const integer = parseInt(colorString, 16);
	const r = (integer >> 16) & 0xFF;
	const g = (integer >> 8) & 0xFF;
	const b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(Math.max(r, g), b);
	const min = Math.min(Math.min(r, g), b);
	const chroma = (max - min);
	let grayscale;
	let hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;

	const c = l < 0.5 ? (2.0 * s * l) : (2.0 * s * (1.0 - l));

	let f = 0;
	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;

	const c = s * v;
	let f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	const h = hcg[0] / 360;
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	const pure = [0, 0, 0];
	const hi = (h % 1) * 6;
	const v = hi % 1;
	const w = 1 - v;
	let mg = 0;

	/* eslint-disable max-statements-per-line */
	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}
	/* eslint-enable max-statements-per-line */

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const v = c + g * (1.0 - c);
	let f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const l = g * (1.0 - c) + 0.5 * c;
	let s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;
	const v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	const w = hwb[1] / 100;
	const b = hwb[2] / 100;
	const v = 1 - b;
	const c = v - w;
	let g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
	return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
	const val = Math.round(gray[0] / 100 * 255) & 0xFF;
	const integer = (val << 16) + (val << 8) + val;

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
	const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};


/***/ }),

/***/ 185:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const conversions = __nccwpck_require__(872);
const route = __nccwpck_require__(200);

const convert = {};

const models = Object.keys(conversions);

function wrapRaw(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];
		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		return fn(args);
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];

		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		const result = fn(args);

		// We're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (let len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(fromModel => {
	convert[fromModel] = {};

	Object.defineProperty(convert[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert[fromModel], 'labels', {value: conversions[fromModel].labels});

	const routes = route(fromModel);
	const routeModels = Object.keys(routes);

	routeModels.forEach(toModel => {
		const fn = routes[toModel];

		convert[fromModel][toModel] = wrapRounded(fn);
		convert[fromModel][toModel].raw = wrapRaw(fn);
	});
});

module.exports = convert;


/***/ }),

/***/ 200:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const conversions = __nccwpck_require__(872);

/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	const graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	const models = Object.keys(conversions);

	for (let len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	const graph = buildGraph();
	const queue = [fromModel]; // Unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		const current = queue.pop();
		const adjacents = Object.keys(conversions[current]);

		for (let len = adjacents.length, i = 0; i < len; i++) {
			const adjacent = adjacents[i];
			const node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	const path = [graph[toModel].parent, toModel];
	let fn = conversions[graph[toModel].parent][toModel];

	let cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

module.exports = function (fromModel) {
	const graph = deriveBFS(fromModel);
	const conversion = {};

	const models = Object.keys(graph);
	for (let len = models.length, i = 0; i < len; i++) {
		const toModel = models[i];
		const node = graph[toModel];

		if (node.parent === null) {
			// No possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};



/***/ }),

/***/ 953:
/***/ ((module) => {



module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};


/***/ }),

/***/ 194:
/***/ ((module) => {



module.exports = (flag, argv = process.argv) => {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};


/***/ }),

/***/ 450:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {


const os = __nccwpck_require__(857);
const tty = __nccwpck_require__(18);
const hasFlag = __nccwpck_require__(194);

const {env} = process;

let forceColor;
if (hasFlag('no-color') ||
	hasFlag('no-colors') ||
	hasFlag('color=false') ||
	hasFlag('color=never')) {
	forceColor = 0;
} else if (hasFlag('color') ||
	hasFlag('colors') ||
	hasFlag('color=true') ||
	hasFlag('color=always')) {
	forceColor = 1;
}

if ('FORCE_COLOR' in env) {
	if (env.FORCE_COLOR === 'true') {
		forceColor = 1;
	} else if (env.FORCE_COLOR === 'false') {
		forceColor = 0;
	} else {
		forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3
	};
}

function supportsColor(haveStream, streamIsTTY) {
	if (forceColor === 0) {
		return 0;
	}

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) {
		return 2;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10 &&
			Number(osRelease[2]) >= 10586
		) {
			return Number(osRelease[2]) >= 14931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function getSupportLevel(stream) {
	const level = supportsColor(stream, stream && stream.isTTY);
	return translateLevel(level);
}

module.exports = {
	supportsColor: getSupportLevel,
	stdout: translateLevel(supportsColor(true, tty.isatty(1))),
	stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};


/***/ }),

/***/ 855:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



var childProcess = __nccwpck_require__(317);
var spawn = childProcess.spawn;
var exec = childProcess.exec;

module.exports = function (pid, signal, callback) {
    if (typeof signal === 'function' && callback === undefined) {
        callback = signal;
        signal = undefined;
    }

    pid = parseInt(pid);
    if (Number.isNaN(pid)) {
        if (callback) {
            return callback(new Error("pid must be a number"));
        } else {
            throw new Error("pid must be a number");
        }
    }

    var tree = {};
    var pidsToProcess = {};
    tree[pid] = [];
    pidsToProcess[pid] = 1;

    switch (process.platform) {
    case 'win32':
        exec('taskkill /pid ' + pid + ' /T /F', callback);
        break;
    case 'darwin':
        buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
          return spawn('pgrep', ['-P', parentPid]);
        }, function () {
            killAll(tree, signal, callback);
        });
        break;
    // case 'sunos':
    //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
    //         killAll(tree, signal, callback);
    //     });
    //     break;
    default: // Linux
        buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
          return spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
        }, function () {
            killAll(tree, signal, callback);
        });
        break;
    }
};

function killAll (tree, signal, callback) {
    var killed = {};
    try {
        Object.keys(tree).forEach(function (pid) {
            tree[pid].forEach(function (pidpid) {
                if (!killed[pidpid]) {
                    killPid(pidpid, signal);
                    killed[pidpid] = 1;
                }
            });
            if (!killed[pid]) {
                killPid(pid, signal);
                killed[pid] = 1;
            }
        });
    } catch (err) {
        if (callback) {
            return callback(err);
        } else {
            throw err;
        }
    }
    if (callback) {
        return callback();
    }
}

function killPid(pid, signal) {
    try {
        process.kill(parseInt(pid, 10), signal);
    }
    catch (err) {
        if (err.code !== 'ESRCH') throw err;
    }
}

function buildProcessTree (parentPid, tree, pidsToProcess, spawnChildProcessesList, cb) {
    var ps = spawnChildProcessesList(parentPid);
    var allData = '';
    ps.stdout.on('data', function (data) {
        var data = data.toString('ascii');
        allData += data;
    });

    var onClose = function (code) {
        delete pidsToProcess[parentPid];

        if (code != 0) {
            // no more parent processes
            if (Object.keys(pidsToProcess).length == 0) {
                cb();
            }
            return;
        }

        allData.match(/\d+/g).forEach(function (pid) {
          pid = parseInt(pid, 10);
          tree[parentPid].push(pid);
          tree[pid] = [];
          pidsToProcess[pid] = 1;
          buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
        });
    };

    ps.on('close', onClose);
}


/***/ }),

/***/ 526:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const core = __importStar(__nccwpck_require__(34));
const fs_1 = __importDefault(__nccwpck_require__(896));
const path_1 = __importDefault(__nccwpck_require__(928));
const runner_js_1 = __nccwpck_require__(813);
//import {pathToFileURL} from 'url'
//import {createRequire} from 'module'
const run = async () => {
    try {
        const cwd = process.env['GITHUB_WORKSPACE'];
        if (!cwd) {
            throw new Error('No GITHUB_WORKSPACE');
        }
        const data = fs_1.default.readFileSync(path_1.default.resolve(cwd, '.github/classroom/autograding.json'));
        const json = JSON.parse(data.toString());
        await (0, runner_js_1.runAll)(json.tests, cwd);
    }
    catch (error) {
        // If there is any error we'll fail the action with the error message
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error('Unknown exception');
        }
        core.setFailed(`Autograding failure: ${error}`); // 1. Establish the base directory safely
    }
};
// Don't auto-execute in the test environment
if (process.env['NODE_ENV'] !== 'test') {
    run();
}
exports["default"] = run;


/***/ }),

/***/ 815:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fuzzySearch = void 0;
/** Performs a fuzzy search over string input to find the closest matching item */
const fuzzySearch = (input, toFind) => {
    const windows = toWindows(input.replace(/\r?\n/g, ' '), toFind.length);
    const firstDistance = [0, jaroWinklerSimilarity(windows[0], toFind)];
    const closestIndex = windows.reduce((prev, curr, index) => {
        const score = jaroWinklerSimilarity(curr, toFind);
        return prev[1] < score ? [index, score] : prev;
    }, firstDistance)[0];
    return windows[closestIndex];
};
exports.fuzzySearch = fuzzySearch;
/**
 * Naive implementation to create windows over the input string
 * Returned array is of size N - S + 1 where N is the amount of characters in the string
 * and S is the required size of the window
 *
 * If the input is smaller than the requested size, an array containing
 * the input will be returned
 */
const toWindows = (input, size) => {
    if (size > input.length) {
        return [input];
    }
    const result = [];
    const lastWindow = input.length - size;
    for (let i = 0; i <= lastWindow; i++) {
        result.push(input.slice(i, i + size));
    }
    return result;
};
/**
 * Calculates the Jaro-Winkler Similarity between two strings.
 * The Jaro Similarity value range is from 0 to 1 where 0 means there is no similarity and 1 means they are equal.
 *
 * Then the Jaro-Winkler Similarity is calculated by multiplying the length of a common prefix up to four characters to
 * a constant `p`
 * Algorithm described here: https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
 */
const jaroWinklerSimilarity = (str1, str2) => {
    if (str1 == str2)
        return 1.0;
    const len1 = str1.length;
    const len2 = str2.length;
    // Max distance between characters to be considered matching
    // This will cause inaccuracies with shorter words (min length for some accuracy is 4)
    const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
    let matches = 0;
    let transpositions = 0;
    const str1Matches = Array(len1).fill(false);
    const str2Matches = Array(len2).fill(false);
    // Iterate through every character of str1
    for (let i = 0; i < len1; i++) {
        // Iterate over a window of characters in str2 with a max width of maxDist * 2
        for (let j = Math.max(0, i - maxDist); j < Math.min(len2, i + maxDist + 1); j++) {
            // If the characters are equal and the second has not been matched yet, consider them a match
            if (str1.charAt(i) === str2.charAt(j) && !str2Matches[j]) {
                str1Matches[i] = true;
                str2Matches[j] = true;
                matches += 1;
                // Found a match! Break and move to the next character
                break;
            }
        }
    }
    // Return 0 if not a single match was found. Considered to have no similarity
    if (matches == 0)
        return 0;
    let k = 0;
    // Go through the matches and calculate the total transpositions
    for (let i = 0; i < len1; i++) {
        if (str1Matches[i]) {
            while (!str2Matches[k])
                k++;
            if (str1.charAt(i) != str2.charAt(k++))
                transpositions++;
        }
    }
    transpositions /= 2;
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0;
    let prefixLength = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
        if (str1.charAt(i) == str2.charAt(i))
            prefixLength++;
    }
    // 0.1 is based on Winkler's original work. Can be any value in the range (0, 0.25]
    return jaro + prefixLength * 0.1 * (1 - jaro);
};


/***/ }),

/***/ 202:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.setCheckRunOutput = void 0;
const core = __importStar(__nccwpck_require__(34));
// output.ts
const github = __importStar(__nccwpck_require__(730));
const setCheckRunOutput = async (text, suffix, level = 'notice') => {
    // If we have nothing to output, then bail
    if (text === '') {
        return;
    }
    const legalNotices = ['notice', 'error', 'warning'];
    if (!level || !legalNotices.includes(level)) {
        level = 'notice';
    }
    // Our action will need to API access the repository so we require a token
    // This will need to be set in the calling workflow, otherwise we'll exit
    const token = process.env['GITHUB_TOKEN'] || core.getInput('token');
    if (!token || token === '')
        return;
    // Create the octokit client
    const octokit = github.getOctokit(token);
    if (!octokit)
        return;
    // The environment contains a variable for current repository. The repository
    // will be formatted as a name with owner (`nwo`); e.g., jeffrafter/example
    // We'll split this into two separate variables for later use
    const nwo = process.env['GITHUB_REPOSITORY'] || '/';
    const [owner, repo] = nwo.split('/');
    if (!owner)
        return;
    if (!repo)
        return;
    // We need the workflow run id
    const runId = parseInt(process.env['GITHUB_RUN_ID'] || '');
    if (Number.isNaN(runId))
        return;
    // Fetch the workflow run
    const workflowRunResponse = await octokit.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
    });
    // Find the check suite run
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkSuiteUrl = workflowRunResponse.data.check_suite_url;
    const checkSuiteId = parseInt(checkSuiteUrl.match(/[0-9]+$/)[0], 10);
    // When this action runs inside a reusable workflow invoked as a job
    // (e.g. shim.yaml's `grade:` job calling classroom-runner-workflow-wcu-standard.yaml),
    // GitHub names the check run "<caller job id> / <called job's name>" — e.g.
    // "grade / Autograding" — not "grade/Autograding". The caller job id isn't
    // guaranteed (a different shim could name its job something else), so match
    // on the job name suffix rather than hardcoding the full prefixed name.
    const checkRunsResponse = await octokit.rest.checks.listForSuite({
        owner,
        repo,
        check_suite_id: checkSuiteId,
    });
    const candidates = checkRunsResponse.data.check_runs.filter((run) => run.name === 'Autograding' || run.name.endsWith('/ Autograding'));
    const checkRun = candidates.length === 1 && candidates[0];
    if (!checkRun)
        return;
    // Split text into chunks of 65,000 characters max
    const maxChars = 65000;
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChars) {
        chunks.push(text.substring(i, i + maxChars));
    }
    // Create annotations from chunks
    const annotations = chunks.map((chunk, index) => ({
        path: '.github',
        start_line: 1,
        end_line: 1,
        annotation_level: level,
        message: chunk,
        title: chunks.length === 1 ? `Autograding ${suffix}` : `Autograding ${suffix} (${index + 1}/${chunks.length})`,
    }));
    //process.stdout.write(`setCheckRunOutput called\n`)
    //process.stdout.write(`Original text length: ${text.length}\n`)
    //process.stdout.write(`Truncated output.text length: ${text.substring(0, maxChars).length}\n`)
    //process.stdout.write(`Number of annotations: ${annotations.length}\n`)
    annotations.forEach((annotation, index) => {
        process.stdout.write(`Annotation ${index + 1} length: ${annotation.message.length}\n`);
    });
    // Update the checkrun, we'll assign the title, summary and text even though we expect
    // the title and summary to be overwritten by GitHub Actions (they are required in this call)
    // We'll also store the total in an annotation to future-proof
    await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRun.id,
        output: {
            title: 'grade/Autograding',
            summary: text.substring(0, 1000),
            text: text.substring(0, maxChars),
            annotations,
        },
    });
};
exports.setCheckRunOutput = setCheckRunOutput;


/***/ }),

/***/ 813:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runAll = exports.run = exports.TestOutputError = exports.TestTimeoutError = exports.TestError = void 0;
const child_process_1 = __nccwpck_require__(317);
const tree_kill_1 = __importDefault(__nccwpck_require__(855));
const uuid_1 = __nccwpck_require__(376);
const core = __importStar(__nccwpck_require__(34));
const output_js_1 = __nccwpck_require__(202);
const os = __importStar(__nccwpck_require__(857));
const chalk_1 = __importDefault(__nccwpck_require__(465));
const fuzzySearch_js_1 = __nccwpck_require__(815);
const fs = __importStar(__nccwpck_require__(896));
const path = __importStar(__nccwpck_require__(928));
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
const color = new chalk_1.default.Instance({ level: 1 });
class TestError extends Error {
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, TestError);
    }
}
exports.TestError = TestError;
class TestTimeoutError extends TestError {
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, TestTimeoutError);
    }
}
exports.TestTimeoutError = TestTimeoutError;
class TestOutputError extends TestError {
    expected;
    actual;
    constructor(message, expected, actual) {
        super(`${message}
    Expected Regular Expression (regex) Match:
${expected}
    Actual:
${actual}`);
        this.expected = expected;
        this.actual = actual;
        Error.captureStackTrace(this, TestOutputError);
    }
}
exports.TestOutputError = TestOutputError;
const log = (text) => {
    process.stdout.write(text + os.EOL);
};
const deriveStatusAndSummary = (result) => {
    const tests = result.tests || [];
    const score = result.score || 0;
    const maxScore = result['max-score'] || 0;
    const assignment = result.assignment || 'assignment';
    if (tests.length === 0) {
        return ['success', `classroom50 autograde: submitted — no autograder configured for ${assignment}`];
    }
    const passedCount = tests.filter((t) => t.passed).length;
    const total = tests.length;
    if (passedCount === total) {
        return ['success', `classroom50 autograde: ${score}/${maxScore} (all tests passed)`];
    }
    return ['failure', `classroom50 autograde: ${score}/${maxScore} (${passedCount}/${total} tests passed)`];
};
const renderReleaseBody = (result, summary) => {
    const score = result.score || 0;
    const maxScore = result['max-score'] || 0;
    const tests = result.tests || [];
    const lines = [`### classroom50 autograde: ${score}/${maxScore}`, ''];
    if (tests.length > 0) {
        lines.push('| Test | Result | Score |');
        lines.push('|---|---|---|');
        for (const t of tests) {
            const ok = t.passed ? 'PASS' : 'FAIL';
            const testName = (t['test-name'] || '').replace(/\|/g, '\\|');
            lines.push(`| ${testName} | ${ok} | ${t.score || 0} / ${t['max-score'] || 0} |`);
        }
        lines.push('');
        lines.push(`Status: ${summary}`);
    }
    else {
        lines.push(`_${summary}_`);
    }
    return lines.join('\n') + '\n';
};
const normalizeLineEndings = (text) => {
    return text.replace(/\r\n/gi, '\n').trim();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const indent = (text) => {
    let str = '' + new String(text);
    str = str.replace(/\r\n/gim, '\n').replace(/\n/gim, '\n  ');
    return str;
};
const compareLines = (actualLine, expectedLine) => {
    const result = [];
    //let cActual = ``
    //let cExpected = ``
    if (actualLine == expectedLine) {
        result.push(`🟩Expected: "` + expectedLine + `"`);
        result.push(`🟩  Actual: "` + actualLine + `"`);
    }
    else {
        const diff = [...expectedLine];
        for (let j = 0; j < expectedLine.length; j++) {
            if (actualLine[j] != expectedLine[j]) {
                //cActual = actualLine[j]
                //cExpected = expectedLine[j]
                diff[j] = `^`;
            }
            else {
                diff[j] = `_`;
            }
        }
        const diffLine = diff.join('');
        result.push(`🟥EXPECTED: "` + expectedLine + `"`);
        result.push(`🟥  ACTUAL: "` + actualLine + `"`);
        result.push(`🟥           ` + diffLine);
        result.push(``);
        //if (expectedLine.length >= actualLine.length) {
        //  result.push(`🟥Character '` + cActual + `' does not match expected character '` + cExpected + `'`)
        //  result.push(``)
        //}
        //result.push(`🟥Note: If both lines look the same, then it could be the an`)
        //result.push(`🟥invisible whitespace such as a tab or newline. Highlighting`)
        //result.push(`🟥and/or copying each line could help you figure out if there`)
        //result.push(`🟥are hidden whitespace characters.`)
    }
    return result.join(os.EOL);
};
const waitForExit = async (child, timeout) => {
    return new Promise((resolve, reject) => {
        let timedOut = false;
        const exitTimeout = setTimeout(() => {
            timedOut = true;
            reject(new TestTimeoutError(`Setup timed out in ${timeout} milliseconds`));
            if (typeof child.pid === 'number')
                (0, tree_kill_1.default)(child.pid);
        }, timeout);
        child.once('exit', (code, signal) => {
            if (timedOut)
                return;
            clearTimeout(exitTimeout);
            if (code === 0) {
                resolve(undefined);
            }
            else {
                reject(new TestError(`Error: Exit with code: ${code} and signal: ${signal}`));
            }
        });
        child.once('error', (error) => {
            if (timedOut)
                return;
            clearTimeout(exitTimeout);
            reject(error);
        });
    });
};
const runSetup = async (test, cwd, timeout) => {
    if (!test.setup || test.setup === '') {
        return;
    }
    const setup = (0, child_process_1.spawn)(test.setup, {
        cwd,
        shell: true,
        env: {
            PATH: process.env['PATH'],
            FORCE_COLOR: 'true',
        },
    });
    let output = '';
    // Start with a single new line
    process.stdout.write(indent('\n'));
    setup.stdout.on('data', (chunk) => {
        process.stdout.write(indent(chunk));
        output += chunk;
    });
    setup.stderr.on('data', (chunk) => {
        process.stderr.write(indent(chunk));
        output += chunk;
    });
    try {
        await waitForExit(setup, timeout);
    }
    catch (error) {
        if (error instanceof TestTimeoutError) {
            throw new TestTimeoutError(output + '\n' + error.message);
        }
        else if (error instanceof TestError) {
            throw new TestError(output + '\n' + error.message);
        }
        else if (error instanceof Error) {
            throw new Error(output + '\n' + error.message, { cause: error });
        }
        else {
            throw new Error(output + '\nUnknown ERROR: ' + `${error}`, { cause: error });
        }
    }
};
// function throwError(header:string,exp:string,act:string) {
//   return new Promise((resolve) => {
//       core.error(`${header}\nExpected:\n${exp}\nActual:\n${act}`)
//       resolve("test")
//   });
// }
const runCommand = async (test, cwd, timeout) => {
    const child = (0, child_process_1.spawn)(test.run, {
        cwd,
        shell: true,
        env: {
            PATH: process.env['PATH'],
            FORCE_COLOR: 'true',
        },
    });
    let output = '';
    // Start with a single new line
    process.stdout.write(indent('\n'));
    child.stdout.on('data', (chunk) => {
        process.stdout.write(indent(chunk));
        output += chunk;
    });
    child.stderr.on('data', (chunk) => {
        process.stderr.write(indent(chunk));
        output += chunk;
    });
    // Preload the inputs
    if (test.input && test.input !== '') {
        child.stdin.write(test.input);
        child.stdin.end();
    }
    try {
        await waitForExit(child, timeout);
    }
    catch (error) {
        if (error instanceof TestTimeoutError) {
            throw new TestTimeoutError(output + '\n' + error.message);
        }
        else if (error instanceof TestError) {
            throw new TestError(output + '\n' + error.message);
        }
        else if (error instanceof Error) {
            throw new Error(output + '\n' + error.message, { cause: error });
        }
        else {
            throw new Error(output + '\nUnknown ERROR: ' + `${error}`, { cause: error });
        }
    }
    // Eventually work off the the test type
    if ((!test.output || test.output == '') && (!test.input || test.input == '')) {
        return output;
    }
    const expected = normalizeLineEndings(test.output || '');
    const actual = normalizeLineEndings(output);
    const exactDiffMessage = (actual, expected) => {
        const linesActual = actual.split(/\r?\n/);
        const linesExpected = expected.split(/\r?\n/);
        const minLines = Math.min(linesActual.length, linesExpected.length);
        const result = [];
        result.push('');
        result.push('Full program output:');
        result.push(actual);
        result.push('');
        result.push('Full expected output for this test:');
        result.push(expected);
        result.push(``);
        result.push(`Num lines to test ` + linesExpected.length);
        result.push(`  Num lines total ` + linesActual.length);
        if (linesExpected.length > linesActual.length) {
            result.push(` missing ` + (linesExpected.length - linesActual.length) + ` lines of output`);
        }
        else if (linesExpected.length < linesActual.length) {
            result.push(` extra ` + (linesActual.length - linesExpected.length) + ` lines of output`);
        }
        else {
            result.push(`line count is correct.`);
        }
        let cActual = ``;
        let cExpected = ``;
        result.push(``);
        // Look at each line
        if (linesExpected.length == linesActual.length) {
            for (let i = 0; i < minLines; i++) {
                const expectedLine = linesExpected[i];
                const actualLine = linesActual[i];
                if (actualLine == expectedLine) {
                    result.push(`🟩Line ` + i + `\tExpected: "` + expectedLine + `"`);
                    result.push(`🟩Line ` + i + `\t  Actual: "` + actualLine + `"`);
                }
                else {
                    result.push(`🟥------- Mismatch on line ` + i);
                    const diff = [...expectedLine];
                    for (let j = 0; j < expectedLine.length; j++) {
                        if (actualLine[j] != expectedLine[j]) {
                            cActual = actualLine[j];
                            cExpected = expectedLine[j];
                            diff[j] = `^`;
                        }
                        else {
                            diff[j] = `_`;
                        }
                    }
                    const diffLine = diff.join('');
                    result.push(``);
                    result.push(`🟥EXPECTED: "` + expectedLine + `"`);
                    result.push(`🟥  ACTUAL: "` + actualLine + `"`);
                    result.push(`🟥           ` + diffLine);
                    result.push(``);
                    if (expectedLine.length >= actualLine.length) {
                        result.push(`🟥Character '` + cActual + `' does not match expected character '` + cExpected + `'`);
                        result.push(``);
                    }
                    result.push(`🟥Note: If both lines look the same, then it could be the an`);
                    result.push(`🟥invisible whitespace such as a tab or newline. Highlighting`);
                    result.push(`🟥and/or copying each line could help you figure out if there`);
                    result.push(`🟥are hidden whitespace characters.`);
                    return result.join(os.EOL);
                }
            }
        }
        else {
            result.push(`comparing each line of expected output against each line of actual output`);
            for (let k = 0; k < linesExpected.length; ++k) {
                const expectedLine = linesExpected[k];
                for (let l = 0; l < linesActual.length; ++l) {
                    const actualLine = linesActual[l];
                    const compare = compareLines(actualLine, expectedLine);
                    result.push(`expected line ` + k + ` actual line ` + l);
                    result.push(compare);
                }
            }
        }
        return result.join(os.EOL);
    };
    const includedDiffMessage = (actual, expected) => {
        const actualLines = actual.split(/\r?\n/);
        const result = ['  '];
        result.push('');
        result.push('Full program output:');
        result.push(actual);
        result.push('');
        result.push('Included string expected for this test:');
        result.push(expected);
        result.push('');
        const closest = (0, fuzzySearch_js_1.fuzzySearch)(actual, expected);
        result.push(`🟥------- Expected text not found `);
        result.push('');
        result.push('🟥EXPECTED: "' + expected + '"');
        // We do not want to consider line endings in the number in character counts
        const closestIndex = actual.replace(/\r?\n/g, '').indexOf(closest);
        let charCount = 0;
        let currLine = 1;
        while (charCount < closestIndex) {
            charCount += actualLines[currLine - 1].length;
            currLine++;
        }
        result.push('🟥 CLOSEST: "' + closest + '" starting on line ' + currLine + ' pos ' + closestIndex);
        result.push('');
        return result.join(os.EOL);
    };
    switch (test.comparison) {
        case 'exact':
            if (actual != expected) {
                //core.group(`Error: ${test.name}`, async() => {
                const result = exactDiffMessage(actual, expected);
                throw new TestError(`The output for test ${test.name} does not match:
${result}`);
                //throw new TestOutputError(`The output for test ${test.name} did not match`, expected, actual)
                //core.endGroup()
            }
            break;
        case 'regex':
            // Note: do not use expected here
            if (!actual.match(new RegExp(test.output || ''))) {
                //core.startGroup(`Error: ${test.name}`)
                throw new TestOutputError(`The output for test ${test.name} did not match`, test.output || '', actual);
                //core.endGroup()
            }
            break;
        default:
            // The default comparison mode is 'included'
            if (!actual.includes(expected)) {
                //core.group(`Error: ${test.name}`, async() => {
                const result = includedDiffMessage(actual, expected);
                throw new TestError(`The output for test ${test.name} did not match:
${result}`);
                //throw new TestOutputError(`The output for test ${test.name} did not match`, expected, actual)
                //core.endGroup()
            }
            break;
    }
    return output;
};
const run = async (test, cwd) => {
    // Timeouts are in minutes, but need to be in ms
    let timeout = (test.timeout || 1) * 60 * 1000 || 30000;
    const start = process.hrtime();
    await runSetup(test, cwd, timeout);
    const elapsed = process.hrtime(start);
    // Subtract the elapsed seconds (0) and nanoseconds (1) to find the remaining timeout
    timeout -= Math.floor(elapsed[0] * 1000 + elapsed[1] / 1000000);
    const result = await runCommand(test, cwd, timeout);
    return result;
};
exports.run = run;
const runAll = async (tests, cwd) => {
    let points = 0;
    let availablePoints = 0;
    let passed = 0;
    let numtests = 0;
    let hasPoints = false;
    let failed = false;
    const passing = [];
    const failing = [];
    const summaryMsgs = [];
    const errMsgs = [];
    const testResults = [];
    for (const test of tests) {
        if (!test.extra) {
            numtests += 1;
        }
        log('');
        // https://help.github.com/en/actions/reference/development-tools-for-github-actions#stop-and-start-log-commands-stop-commands
        const token = (0, uuid_1.v4)();
        log('');
        log(`::stop-commands::${token}`);
        log('');
        try {
            if (test.points) {
                hasPoints = true;
                if (!test.extra) {
                    availablePoints += test.points;
                }
            }
            log(color.cyan(`📝 ${test.name}`));
            const result = await (0, exports.run)(test, cwd);
            // Restart command processing
            log('');
            log(`::${token}::`);
            log('');
            log(color.green(`🏁 completed - ${test.name}`));
            log(``);
            let notice = `🏁 Passed ${test.name}\n`;
            notice += '\n' + result + '\n';
            //core.notice(notice, nAnn)
            //log(`about to call setCheckRunOutput\n`)
            //log(`Original text length: ${notice.length}\n`)
            await (0, output_js_1.setCheckRunOutput)(notice, test.name);
            if (test.points) {
                points += test.points;
            }
            if (!test.extra) {
                passing.push(test.name);
                passed += 1;
                // default to 1/1 if there are no points
                testResults.push({
                    'test-name': test.name,
                    passed: true,
                    score: test.points || 1,
                    'max-score': test.points || 1,
                });
            }
            else {
                // max score is 0 on extra credit
                testResults.push({
                    'test-name': test.name,
                    passed: true,
                    score: test.points || 1,
                    'max-score': 0,
                });
            }
        }
        catch (error) {
            log('');
            // Restart command processing
            log('');
            log(`::${token}::`);
            log(color.yellow(`🚧 needs repair - ${test.name}`));
            if (!test.extra) {
                failing.push(test.name);
                failed = true;
                if (error instanceof Error) {
                    let eMsg = `🚧 Needs Repair - ${test.name}\n`;
                    eMsg += error.message + '\n';
                    const errors = [];
                    errors.push(error.message);
                    if (error.message.indexOf('regex') != -1) {
                        const sText = '**' +
                            test.name +
                            ' Note:** Go to [debuggex](https://www.debuggex.com) for help with regular expression problems. It will take the *Expected* text in the first box and the *Actual* text in the second box and show you a *red line* for where the test fails.';
                        const eText = `Note: Go to https://www.debuggex.com for help with regular expression problems. It will take the Expected text in the first box and the Actual text in the second box and show you a red line for where the test fails.`;
                        eMsg += eText;
                        summaryMsgs.push(sText);
                        errMsgs.push(test.name + ' ' + eText);
                        errors.push(eText);
                    }
                    //core.error(eMsg, eAnn)
                    await (0, output_js_1.setCheckRunOutput)(eMsg, test.name, 'failure');
                    //core.summary.write()
                    log(errors.join(os.EOL));
                }
                else {
                    let eMsg = `🚧 Needs Repair - ${test.name}\n`;
                    eMsg += `Unknown Exception: ${error}`;
                    await (0, output_js_1.setCheckRunOutput)(eMsg, test.name, 'failure');
                    //core.error(eMsg, eAnn)
                    log(`Unknown exception: ${error}`);
                }
                testResults.push({
                    'test-name': test.name,
                    passed: false,
                    score: 0,
                    'max-score': test.points || 1,
                });
            }
            else {
                testResults.push({
                    'test-name': test.name,
                    passed: false,
                    score: 0,
                    'max-score': 0,
                });
            }
        }
    }
    if (failed) {
        // We need a good failure experience
        log('');
        log(color.red('At least one test failed'));
        log('');
        log('Please, look at the output and make sure it makes sense to you.');
        log(' If it does, then check the requirements to see what formatting may need to change.');
        log('');
    }
    else {
        log('');
        log(color.green('All tests passed'));
        log('');
        log('Please, still look at the output and make sure it looks right to you.');
        log('');
        log('✨🌟💖💎🦄💎💖🌟✨🌟💖💎🦄💎💖🌟✨');
        log('');
    }
    if (points > availablePoints) {
        const extraCreditPoints = 1 * (points - availablePoints);
        log(`💪💪💪 You earned ${extraCreditPoints} extra credit points`);
        log('');
    }
    let text = `Tests Passed: ${passed}/${numtests}  
  Passing tests: ${passing}  
  Failing tests: ${failing}\n`;
    core.summary.addRaw('## Test Summary', true);
    core.summary.addRaw(text, true);
    core.summary.addRaw(summaryMsgs.join(os.EOL), true);
    core.summary.addRaw('Check *Annotations* for individual test results', true);
    core.summary.write();
    //log(color.bold.bgCyan.black(text))
    text += errMsgs.join(os.EOL) + '\n';
    text += 'Check Annotations for individual test results\n';
    log(color.bold.bgCyan.black(text));
    log('');
    log('');
    //core.notice(text, {title: 'Testing Summary'})
    await (0, output_js_1.setCheckRunOutput)(text, 'Summary');
    // Set the number of points
    if (hasPoints) {
        const text = `Points ${points}/${availablePoints}`;
        log(color.bold.bgCyan.black(text));
        core.setOutput('Points', `${points}/${availablePoints}`);
        await (0, output_js_1.setCheckRunOutput)(text, 'complete');
        //core.notice(text, {title: 'Autograding complete'})
    }
    else {
        // set the number of tests that passed
        const text = `Points ${passed}/${numtests}`;
        //Passing tests: ${passing}
        //Failing tests: ${failing}`
        //log(color.bold.bgCyan.black(text))
        log(color.bold.bgCyan.black(text));
        core.setOutput('Points', `${passed}/${numtests}`);
        await (0, output_js_1.setCheckRunOutput)(text, 'complete');
        //core.notice(text, {title: 'Autograding complete'})
    }
    try {
        let finalScore = 0;
        let finalMaxScore = 0;
        if (hasPoints) {
            finalScore = points;
            finalMaxScore = availablePoints;
        }
        else {
            finalScore = passed;
            finalMaxScore = numtests;
        }
        // autofeedback-s is invoked directly as an Action step in autograde.yaml
        // — runner.py is never in this loop, so USERNAME/COMMIT_URL/RELEASE_URL/
        // ASSIGNMENT_TYPE (which only ever existed because runner.py injected
        // them into a subprocess it spawned) are NOT available here. Everything
        // below is derived instead from the standard GITHUB_* context vars every
        // step gets for free, plus MODE (which IS in the grade job's own env:
        // block, sourced from assignments.json). Getting `owner` wrong/empty is
        // what silently drops a submission from collect-scores — that field is
        // the identity anchor it validates against the source repo.
        const repoSlug = process.env.GITHUB_REPOSITORY || '';
        // NOT GITHUB_REPOSITORY_OWNER — classroom50 repos are org-owned
        // (e.g. WCU-CS-CooperLab/wcu-csc-240-hw0-testing-cooplogic), so that var
        // is always the org login, never the student. The student's identity
        // lives in the repo NAME suffix, not repo ownership. GITHUB_ACTOR (who
        // triggered this run) is the student for a normal individual submission.
        const owner = process.env.USERNAME || process.env.GITHUB_ACTOR || '';
        const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
        const sha = process.env.GITHUB_SHA || '';
        const submissionTag = process.env.SUBMISSION_TAG || '';
        const assignmentType = process.env.MODE === 'group' ? 'group' : 'individual';
        // The release doesn't exist yet at grading time (it's created by a
        // later workflow step, from this very result.json) — so this is the
        // predictable URL a submit/* tag's release resolves to once created,
        // not a lookup. GitHub Release tag URLs percent-encode '/' as %2F.
        const releaseUrl = repoSlug && submissionTag ? `${serverUrl}/${repoSlug}/releases/tag/${encodeURIComponent(submissionTag)}` : '';
        const commitUrl = repoSlug && sha ? `${serverUrl}/${repoSlug}/commit/${sha}` : '';
        // %Y-%m-%dT%H:%M:%SZ — no fractional seconds. runner.py uses this exact
        // format for both datetime and graded_at; toISOString()'s milliseconds
        // (".161Z") don't match it, which is plausibly what a stricter
        // date-parsing consumer (e.g. a submissions-list view sorting on this
        // field) silently chokes on where a simple score readout wouldn't.
        const formatTimestamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        // datetime is meant to be the SUBMISSION instant — the graded commit's
        // committer date, invariant across regrades — not "whenever this run
        // happened to execute". Read it straight from git rather than the API
        // (avoids needing a token for this): the checkout already has full
        // history (fetch-depth: 0). graded_at is genuinely "now", separately.
        let submittedAt;
        try {
            submittedAt = (0, child_process_1.execFileSync)('git', ['show', '-s', '--format=%cI', sha || 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
        }
        catch (error) {
            log(`Could not read committer date via git, falling back to now: ${errorMessage(error)}`);
            submittedAt = new Date().toISOString();
        }
        const datetime = formatTimestamp(new Date(submittedAt));
        const gradedAt = formatTimestamp(new Date());
        const actorId = process.env.GITHUB_ACTOR_ID;
        const submittedBy = process.env.GITHUB_ACTOR
            ? { username: process.env.GITHUB_ACTOR, id: actorId ? Number(actorId) : null }
            : undefined;
        const result = {
            schema: 'classroom50/result/v1',
            classroom: process.env.CLASSROOM || '',
            assignment: process.env.ASSIGNMENT || '',
            assignment_type: assignmentType,
            owner,
            submission: submissionTag,
            commit: commitUrl,
            release: releaseUrl,
            // TODO: a true starter->graded-commit diff needs the baseline commit
            // (the one that added .classroom50.yaml), which isn't resolved
            // anywhere in this bridge yet — same gap as baseline-sha/head-sha for
            // the Feedback PR step. Falling back to the commit URL for now rather
            // than leaving this empty.
            review: commitUrl,
            datetime,
            graded_at: gradedAt,
            ...(submittedBy ? { submitted_by: submittedBy } : {}),
            score: finalScore,
            'max-score': finalMaxScore,
            tests: testResults,
        };
        const resultJson = JSON.stringify(result, null, 2);
        // Working directory is the student's checkout, and result.json is
        // required to land there as a relative "./result.json".
        const resultFilePath = path.join(cwd, 'result.json');
        fs.writeFileSync(resultFilePath, resultJson, 'utf-8');
        log(`Wrote grading payload to: ${resultFilePath}`);
        // release-body.md is optional per the contract (the runner synthesizes
        // it when absent), but ported here for parity with runner.py so
        // submissions graded through this bridge get the same Markdown body —
        // score line + per-test table — as ones graded straight through
        // runner.py, instead of falling back to whatever generic body the
        // runner synthesizes for "autograder produced no release-body.md".
        const [status, summary] = deriveStatusAndSummary(result);
        const releaseBody = renderReleaseBody(result, summary);
        const releaseBodyPath = path.join(cwd, 'release-body.md');
        fs.writeFileSync(releaseBodyPath, releaseBody, 'utf-8');
        log(`Wrote release body to: ${releaseBodyPath} (status: ${status})`);
        // autograde.yaml's set-latest job, the "Post commit status" step, and
        // the "Publish submission release" step all key off
        // steps.autograde.outputs.status/summary. Without these, that output
        // is always empty — set-latest's condition
        // (needs.grade.outputs.status == 'success' || ... == 'failure')
        core.setOutput('status', status);
        core.setOutput('summary', summary);
    }
    catch (error) {
        // Set failure when results.json isn't created.
        // Still emit status/summary outputs (matching runner.py's error() path)
        // so "Post commit status" reports something specific instead of falling
        // back to its own generic default
        const errorSummary = `classroom50 autograde: ${errorMessage(error)}`;
        core.setOutput('status', 'error');
        core.setOutput('summary', errorSummary);
        core.setFailed(`Autograding complete but score delivery failed: ${errorMessage(error)}`);
    }
};
exports.runAll = runAll;


/***/ }),

/***/ 34:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("@actions/core");

/***/ }),

/***/ 730:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("@actions/github");

/***/ }),

/***/ 317:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("child_process");

/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("fs");

/***/ }),

/***/ 857:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("os");

/***/ }),

/***/ 928:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("path");

/***/ }),

/***/ 18:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("tty");

/***/ }),

/***/ 376:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __nccwpck_require__) => {

// ESM COMPAT FLAG
__nccwpck_require__.r(__webpack_exports__);

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  MAX: () => (/* reexport */ max),
  NIL: () => (/* reexport */ nil),
  parse: () => (/* reexport */ dist_node_parse),
  stringify: () => (/* reexport */ dist_node_stringify),
  v1: () => (/* reexport */ dist_node_v1),
  v1ToV6: () => (/* reexport */ v1ToV6),
  v3: () => (/* reexport */ dist_node_v3),
  v4: () => (/* reexport */ dist_node_v4),
  v5: () => (/* reexport */ dist_node_v5),
  v6: () => (/* reexport */ dist_node_v6),
  v6ToV1: () => (/* reexport */ v6ToV1),
  v7: () => (/* reexport */ dist_node_v7),
  validate: () => (/* reexport */ dist_node_validate),
  version: () => (/* reexport */ dist_node_version)
});

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/max.js
/* harmony default export */ const max = ('ffffffff-ffff-ffff-ffff-ffffffffffff');

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/nil.js
/* harmony default export */ const nil = ('00000000-0000-0000-0000-000000000000');

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/regex.js
/* harmony default export */ const regex = (/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/validate.js

function validate(uuid) {
    return typeof uuid === 'string' && regex.test(uuid);
}
/* harmony default export */ const dist_node_validate = (validate);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/parse.js

function parse(uuid) {
    if (!dist_node_validate(uuid)) {
        throw TypeError('Invalid UUID');
    }
    let v;
    return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 0xff, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 0xff, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 0xff, ((v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000) & 0xff, (v / 0x100000000) & 0xff, (v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}
/* harmony default export */ const dist_node_parse = (parse);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/stringify.js

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] +
        byteToHex[arr[offset + 1]] +
        byteToHex[arr[offset + 2]] +
        byteToHex[arr[offset + 3]] +
        '-' +
        byteToHex[arr[offset + 4]] +
        byteToHex[arr[offset + 5]] +
        '-' +
        byteToHex[arr[offset + 6]] +
        byteToHex[arr[offset + 7]] +
        '-' +
        byteToHex[arr[offset + 8]] +
        byteToHex[arr[offset + 9]] +
        '-' +
        byteToHex[arr[offset + 10]] +
        byteToHex[arr[offset + 11]] +
        byteToHex[arr[offset + 12]] +
        byteToHex[arr[offset + 13]] +
        byteToHex[arr[offset + 14]] +
        byteToHex[arr[offset + 15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    if (!dist_node_validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
/* harmony default export */ const dist_node_stringify = (stringify);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/rng.js
const rnds8 = new Uint8Array(16);
function rng() {
    return crypto.getRandomValues(rnds8);
}

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v1.js


const _state = {};
function v1(options, buf, offset) {
    let bytes;
    const isV6 = options?._v6 ?? false;
    if (options) {
        const optionsKeys = Object.keys(options);
        if (optionsKeys.length === 1 && optionsKeys[0] === '_v6') {
            options = undefined;
        }
    }
    if (options) {
        bytes = v1Bytes(options.random ?? options.rng?.() ?? rng(), options.msecs, options.nsecs, options.clockseq, options.node, buf, offset);
    }
    else {
        const now = Date.now();
        const rnds = rng();
        updateV1State(_state, now, rnds);
        bytes = v1Bytes(rnds, _state.msecs, _state.nsecs, isV6 ? undefined : _state.clockseq, isV6 ? undefined : _state.node, buf, offset);
    }
    return buf ?? unsafeStringify(bytes);
}
function updateV1State(state, now, rnds) {
    state.msecs ??= -Infinity;
    state.nsecs ??= 0;
    if (now === state.msecs) {
        state.nsecs++;
        if (state.nsecs >= 10000) {
            state.node = undefined;
            state.nsecs = 0;
        }
    }
    else if (now > state.msecs) {
        state.nsecs = 0;
    }
    else if (now < state.msecs) {
        state.node = undefined;
    }
    if (!state.node) {
        state.node = rnds.slice(10, 16);
        state.node[0] |= 0x01;
        state.clockseq = ((rnds[8] << 8) | rnds[9]) & 0x3fff;
    }
    state.msecs = now;
    return state;
}
function v1Bytes(rnds, msecs, nsecs, clockseq, node, buf, offset = 0) {
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    if (!buf) {
        buf = new Uint8Array(16);
        offset = 0;
    }
    else {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
    }
    msecs ??= Date.now();
    nsecs ??= 0;
    clockseq ??= ((rnds[8] << 8) | rnds[9]) & 0x3fff;
    node ??= rnds.slice(10, 16);
    msecs += 12219292800000;
    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    buf[offset++] = (tl >>> 24) & 0xff;
    buf[offset++] = (tl >>> 16) & 0xff;
    buf[offset++] = (tl >>> 8) & 0xff;
    buf[offset++] = tl & 0xff;
    const tmh = ((msecs / 0x100000000) * 10000) & 0xfffffff;
    buf[offset++] = (tmh >>> 8) & 0xff;
    buf[offset++] = tmh & 0xff;
    buf[offset++] = ((tmh >>> 24) & 0xf) | 0x10;
    buf[offset++] = (tmh >>> 16) & 0xff;
    buf[offset++] = (clockseq >>> 8) | 0x80;
    buf[offset++] = clockseq & 0xff;
    for (let n = 0; n < 6; ++n) {
        buf[offset++] = node[n];
    }
    return buf;
}
/* harmony default export */ const dist_node_v1 = (v1);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v1ToV6.js


function v1ToV6(uuid) {
    const v1Bytes = typeof uuid === 'string' ? dist_node_parse(uuid) : uuid;
    const v6Bytes = _v1ToV6(v1Bytes);
    return typeof uuid === 'string' ? unsafeStringify(v6Bytes) : v6Bytes;
}
function _v1ToV6(v1Bytes) {
    return Uint8Array.of(((v1Bytes[6] & 0x0f) << 4) | ((v1Bytes[7] >> 4) & 0x0f), ((v1Bytes[7] & 0x0f) << 4) | ((v1Bytes[4] & 0xf0) >> 4), ((v1Bytes[4] & 0x0f) << 4) | ((v1Bytes[5] & 0xf0) >> 4), ((v1Bytes[5] & 0x0f) << 4) | ((v1Bytes[0] & 0xf0) >> 4), ((v1Bytes[0] & 0x0f) << 4) | ((v1Bytes[1] & 0xf0) >> 4), ((v1Bytes[1] & 0x0f) << 4) | ((v1Bytes[2] & 0xf0) >> 4), 0x60 | (v1Bytes[2] & 0x0f), v1Bytes[3], v1Bytes[8], v1Bytes[9], v1Bytes[10], v1Bytes[11], v1Bytes[12], v1Bytes[13], v1Bytes[14], v1Bytes[15]);
}

;// CONCATENATED MODULE: external "node:crypto"
const external_node_crypto_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:crypto");
;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/md5.js

function md5(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    }
    else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return (0,external_node_crypto_namespaceObject.createHash)('md5').update(bytes).digest();
}
/* harmony default export */ const dist_node_md5 = (md5);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v35.js


function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; ++i) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(version, hash, value, namespace, buf, offset) {
    const valueBytes = typeof value === 'string' ? stringToBytes(value) : value;
    const namespaceBytes = typeof namespace === 'string' ? dist_node_parse(namespace) : namespace;
    if (typeof namespace === 'string') {
        namespace = dist_node_parse(namespace);
    }
    if (namespace?.length !== 16) {
        throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    }
    let bytes = new Uint8Array(16 + valueBytes.length);
    bytes.set(namespaceBytes);
    bytes.set(valueBytes, namespaceBytes.length);
    bytes = hash(bytes);
    bytes[6] = (bytes[6] & 0x0f) | version;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    if (buf) {
        offset ??= 0;
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = bytes[i];
        }
        return buf;
    }
    return unsafeStringify(bytes);
}

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v3.js



function v3(value, namespace, buf, offset) {
    return v35(0x30, dist_node_md5, value, namespace, buf, offset);
}
v3.DNS = DNS;
v3.URL = URL;
/* harmony default export */ const dist_node_v3 = (v3);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v4.js


function v4(options, buf, offset) {
    if (!buf && !options && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
    options = options || {};
    const rnds = options.random ?? options.rng?.() ?? rng();
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;
    if (buf) {
        offset = offset || 0;
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = rnds[i];
        }
        return buf;
    }
    return unsafeStringify(rnds);
}
/* harmony default export */ const dist_node_v4 = (v4);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/sha1.js

function sha1(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    }
    else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return (0,external_node_crypto_namespaceObject.createHash)('sha1').update(bytes).digest();
}
/* harmony default export */ const dist_node_sha1 = (sha1);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v5.js



function v5(value, namespace, buf, offset) {
    return v35(0x50, dist_node_sha1, value, namespace, buf, offset);
}
v5.DNS = DNS;
v5.URL = URL;
/* harmony default export */ const dist_node_v5 = (v5);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v6.js



function v6(options, buf, offset) {
    options ??= {};
    offset ??= 0;
    let bytes = dist_node_v1({ ...options, _v6: true }, new Uint8Array(16));
    bytes = v1ToV6(bytes);
    if (buf) {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; i++) {
            buf[offset + i] = bytes[i];
        }
        return buf;
    }
    return unsafeStringify(bytes);
}
/* harmony default export */ const dist_node_v6 = (v6);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v6ToV1.js


function v6ToV1(uuid) {
    const v6Bytes = typeof uuid === 'string' ? dist_node_parse(uuid) : uuid;
    const v1Bytes = _v6ToV1(v6Bytes);
    return typeof uuid === 'string' ? unsafeStringify(v1Bytes) : v1Bytes;
}
function _v6ToV1(v6Bytes) {
    return Uint8Array.of(((v6Bytes[3] & 0x0f) << 4) | ((v6Bytes[4] >> 4) & 0x0f), ((v6Bytes[4] & 0x0f) << 4) | ((v6Bytes[5] & 0xf0) >> 4), ((v6Bytes[5] & 0x0f) << 4) | (v6Bytes[6] & 0x0f), v6Bytes[7], ((v6Bytes[1] & 0x0f) << 4) | ((v6Bytes[2] & 0xf0) >> 4), ((v6Bytes[2] & 0x0f) << 4) | ((v6Bytes[3] & 0xf0) >> 4), 0x10 | ((v6Bytes[0] & 0xf0) >> 4), ((v6Bytes[0] & 0x0f) << 4) | ((v6Bytes[1] & 0xf0) >> 4), v6Bytes[8], v6Bytes[9], v6Bytes[10], v6Bytes[11], v6Bytes[12], v6Bytes[13], v6Bytes[14], v6Bytes[15]);
}

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/v7.js


const v7_state = {};
function v7(options, buf, offset) {
    let bytes;
    if (options) {
        bytes = v7Bytes(options.random ?? options.rng?.() ?? rng(), options.msecs, options.seq, buf, offset);
    }
    else {
        const now = Date.now();
        const rnds = rng();
        updateV7State(v7_state, now, rnds);
        bytes = v7Bytes(rnds, v7_state.msecs, v7_state.seq, buf, offset);
    }
    return buf ?? unsafeStringify(bytes);
}
function updateV7State(state, now, rnds) {
    state.msecs ??= -Infinity;
    state.seq ??= 0;
    if (now > state.msecs) {
        state.seq = (rnds[6] << 23) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
        state.msecs = now;
    }
    else {
        state.seq = (state.seq + 1) | 0;
        if (state.seq === 0) {
            state.msecs++;
        }
    }
    return state;
}
function v7Bytes(rnds, msecs, seq, buf, offset = 0) {
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    if (!buf) {
        buf = new Uint8Array(16);
        offset = 0;
    }
    else {
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
    }
    msecs ??= Date.now();
    seq ??= ((rnds[6] * 0x7f) << 24) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
    buf[offset++] = (msecs / 0x10000000000) & 0xff;
    buf[offset++] = (msecs / 0x100000000) & 0xff;
    buf[offset++] = (msecs / 0x1000000) & 0xff;
    buf[offset++] = (msecs / 0x10000) & 0xff;
    buf[offset++] = (msecs / 0x100) & 0xff;
    buf[offset++] = msecs & 0xff;
    buf[offset++] = 0x70 | ((seq >>> 28) & 0x0f);
    buf[offset++] = (seq >>> 20) & 0xff;
    buf[offset++] = 0x80 | ((seq >>> 14) & 0x3f);
    buf[offset++] = (seq >>> 6) & 0xff;
    buf[offset++] = ((seq << 2) & 0xff) | (rnds[10] & 0x03);
    buf[offset++] = rnds[11];
    buf[offset++] = rnds[12];
    buf[offset++] = rnds[13];
    buf[offset++] = rnds[14];
    buf[offset++] = rnds[15];
    return buf;
}
/* harmony default export */ const dist_node_v7 = (v7);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/version.js

function version(uuid) {
    if (!dist_node_validate(uuid)) {
        throw TypeError('Invalid UUID');
    }
    return parseInt(uuid.slice(14, 15), 16);
}
/* harmony default export */ const dist_node_version = (version);

;// CONCATENATED MODULE: ./node_modules/uuid/dist-node/index.js
















/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		id: moduleId,
/******/ 		loaded: false,
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Flag the module as loaded
/******/ 	module.loaded = true;
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__nccwpck_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/node module decorator */
/******/ (() => {
/******/ 	__nccwpck_require__.nmd = (module) => {
/******/ 		module.paths = [];
/******/ 		if (!module.children) module.children = [];
/******/ 		return module;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
/******/ 
/******/ // startup
/******/ // Load entry module and return exports
/******/ // This entry module is referenced by other modules so it can't be inlined
/******/ var __webpack_exports__ = __nccwpck_require__(526);
/******/ 
