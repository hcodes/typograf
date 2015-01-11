/*! Typograf | © 2014 Denis Seleznev | https://github.com/typograf/typograf/ */

/**
 * @constructor
 * @param {Object} [prefs]
 * @param {string} [prefs.lang] Language rules
 * @param {string} [prefs.mode] HTML entities as: 'default' - UTF-8, 'digit' - &#160;, 'name' - &nbsp;
 */
function Typograf(prefs) {
    this._prefs = typeof prefs === 'object' ? prefs : {};

    this._settings = {};
    this._enabledRules = {};

    this._initSafeTags();
    this._rules.forEach(this._prepareRule, this);
}

/**
 * Add a rule.
 *
 * @static
 * @param {Object} rule
 * @param {string} rule.name Name of rule
 * @param {Function} rule.func Processing function
 * @param {string} [rule.sortIndex] Sorting index for rule
 * @param {boolean} [rule.enabled] Rule is enabled by default
 * @return {Typograf} this
 */
Typograf.rule = function(rule) {
    rule.enabled = rule.enabled === false ? false : true;
    rule._lang = rule.name.split('/')[0];
    rule.sortIndex = rule.sortIndex || 0;

    Typograf.prototype._rules.push(rule);

    if(Typograf._needSortRules) {
        this._sortRules();
    }

    return this;
};

/**
 * Add internal rule.
 * Internal rules are executed before main.
 *
 * @static
 * @param {Object} rule
 * @param {string} rule.name Name of rule
 * @param {Function} rule.func Processing function
 * @param {string} [rule.sortIndex] Sorting index for rule
 * @return {Typograf} this
 */
Typograf.innerRule = function(rule) {
    Typograf.prototype._innerRules.push(rule);

    rule._lang = rule.name.split('/')[0];
    rule.sortIndex = rule.sortIndex || 0;

    if(Typograf._needSortRules) {
        this._sortInnerRules();
    }

    return this;
};

/**
 * Add data for use in rules.
 *
 * @static
 * @param {string} key
 * @param {*} value
 */
Typograf.data = function(key, value) {
    Typograf.prototype.data[key] = value;
};

Typograf._sortRules = function() {
    Typograf.prototype._rules.sort(function(a, b) {
        return a.sortIndex > b.sortIndex ? 1 : -1;
    });
};

Typograf._sortInnerRules = function() {
    Typograf.prototype._innerRules.sort(function(a, b) {
        return a.sortIndex > b.sortIndex ? 1 : -1;
    });
};

Typograf.prototype = {
    constructor: Typograf,
    /**
     * Execute typographical rules for text.
     *
     * @param {string} text
     * @param {Object} [prefs]
     * @param {string} [prefs.lang] Language rules
     * @param {string} [prefs.mode] Type HTML entities
     * @return {string}
     */
    execute: function(text, prefs) {
        prefs = prefs || {};

        var that = this,
            lang = prefs.lang || this._prefs.lang || 'common',
            rulesForQueue = {},
            innerRulesForQueue = {},
            mode = typeof prefs.mode === 'undefined' ? this._prefs.mode : prefs.mode,
            iterator = function(rule) {
                var rlang = rule._lang;

                if((rlang === 'common' || rlang === lang) && this.enabled(rule.name)) {
                    text = rule.func.call(this, text, this._settings[rule.name]);
                }
            },
            executeRulesForQueue = function(queue) {
                innerRulesForQueue[queue] && innerRulesForQueue[queue].forEach(iterator, that);
                rulesForQueue[queue] && rulesForQueue[queue].forEach(iterator, that);
            };
        
        this._lang = lang;

        text = '' + text;

        if(!text) {
            return '';
        }

        text = this._fixLineEnd(text);

        this._innerRules.forEach(function(rule) {
            var q = rule.queue;
            innerRulesForQueue[q] = innerRulesForQueue[q] || [];
            innerRulesForQueue[q].push(rule);
        }, this);

        this._rules.forEach(function(rule) {
            var q = rule.queue;
            rulesForQueue[q] = rulesForQueue[q] || [];
            rulesForQueue[q].push(rule);
        }, this);

        executeRulesForQueue('start');

        var isHTML = text.search(/<[a-z!]/i) !== -1;
        if(isHTML) {
            text = this._hideSafeTags(text);
        }

        text = this._utfication(text);
        executeRulesForQueue();
        text = this._modification(text, mode);

        if(isHTML) {
            text = this._showSafeTags(text);
        }

        executeRulesForQueue('end');

        this._lang = null;

        return text;
    },
    /**
     * Get/set a setting
     *
     * @param {string} ruleName
     * @param {string} setting
     * @param {*} [value]
     * @return {*}
     */
    setting: function(ruleName, setting, value) {
        if(arguments.length <= 2) {
            return this._settings[ruleName] && this._settings[ruleName][setting];
        } else {
            this._settings[ruleName] = this._settings[ruleName] || {};
            this._settings[ruleName][setting] = value;

            return this;
        }
    },
    /**
     * Is enabled a rule.
     *
     * @param {string} ruleName
     * @return {boolean}
     */
    enabled: function(ruleName) {
        return this._enabledRules[ruleName];
    },
    /**
     * Is disabled a rule.
     *
     * @param {string} ruleName
     * @return {boolean}
     */
    disabled: function(ruleName) {
        return !this._enabledRules[ruleName];
    },
    /**
     * Enable a rule.
     *
     * @param {string} ruleName
     * @return {boolean}
     */
    enable: function(ruleName) {
        return this._enable(ruleName, true);
    },
    /**
     * Disable a rule.
     *
     * @param {string|Array[string]} ruleName
     * @return {boolean}
     */
    disable: function(ruleName) {
        return this._enable(ruleName, false);
    },
    /**
     * Add safe tag.
     *
     * @param {string} startTag
     * @param {string} endTag
     */
    addSafeTag: function(startTag, endTag) {
        this._safeTags.push([startTag, endTag]);
    },
    /**
     * Get a string of characters with range for current language.
     * This is used in regular expressions in rules.
     *
     * @return {string}
     */    
    letters: function() {
        var lang = this._lang || this._prefs.lang,
            commonLetter = this.data['common/letter'],
            langLetter = this.data[lang + '/letter'];
        
        return commonLetter === langLetter || !lang ? commonLetter : commonLetter + langLetter;
    },
    data: {},
    _fixLineEnd: function(text) {
        return text
            .replace(/\r\n/g, '\n') // Windows
            .replace(/\r/g, '\n'); // MacOS
    },
    _prepareRule: function(rule) {
        var name = rule.name;
        this._settings[name] = rule.settings || {};
        this._enabledRules[name] = rule.enabled;
    },
    _enable: function(rule, enabled) {
        if(Array.isArray(rule)) {
            rule.forEach(function(el) {
                this._enableByMask(el, enabled);
            }, this);
        } else {
            this._enableByMask(rule, enabled);
        }

        return this;
    },
    _enableByMask: function(rule, enabled) {
        var re;
        if(rule.search(/\*/) !== -1) {
            re = new RegExp(rule
                .replace(/\//g, '\\\/')
                .replace(/\*/g, '.*'));

            this._rules.forEach(function(el) {
                var name = el.name;
                if(re.test(name)) {
                    this._enabledRules[name] = enabled;
                }
            }, this);
        } else {
            this._enabledRules[rule] = enabled;
        }
    },
    _rules: [],
    _innerRules: [],
    _initSafeTags: function() {
        this._safeTags = [
            ['<!--', '-->'],
            ['<!ENTITY', '>'],
            ['<!DOCTYPE', '>'],
            ['<\\?xml', '\\?>'],
            ['<!\\[CDATA\\[', '\\]\\]>']
        ];

        [
            'code',
            'kbd',
            'object',
            'pre',
            'samp',
            'script',
            'style',
            'var'
        ].forEach(function(tag) {
            this._safeTags.push(['<' + tag + '(\\s[^>]*?)?>', '</' + tag + '>']);
        }, this);
    },
    _hideSafeTags: function(text) {
        this._hiddenSafeTags = {};

        var that = this,
            i = 0,
            pasteTag = function(match) {
                var key = '\uDBFFtypograf' + i + '\uDBFF';
                that._hiddenSafeTags[key] = match;
                i++;

                return key;
            };

        this._safeTags.forEach(function(tag) {
            var re = new RegExp(tag[0] + '[^]*?' + tag[1], 'gi');
            text = text.replace(re, pasteTag);
        });

        return text.replace(/<[a-z\/][^>]*?>/gi, pasteTag);
    },
    _showSafeTags: function(text) {
        var replace = function(key) {
            text = text.replace(new RegExp(key, 'gi'), this._hiddenSafeTags[key]);
        };

        for(var i = 0; i < this._safeTags.length; i++) {
            Object.keys(this._hiddenSafeTags).forEach(replace, this);

            if(text.search(/\uDBFFtypograf[\d]+\uDBFF/) < 0) {
                break;
            }
        }

        delete this._hiddenSafeTags;

        return text;
    },
    _utfication: function(text) {
        if(text.search(/&#/) !== -1) {
            text = this._decHexToUtf(text);
        }
        
        if(text.search(/&[a-z]/i) !== -1) {
            this.entities.forEach(function(entity) {
                text = text.replace(entity[3], entity[2]);
            });
        }

        return text;
    },
    _decHexToUtf: function(text) {
        return text
            .replace(/&#(\d{1,6});/gi, function($0, $1) {
                return String.fromCharCode(parseInt($1, 10));
            })
            .replace(/&#x([\da-f]{1,6});/gi, function($0, $1) {
                return String.fromCharCode(parseInt($1, 16));
            });
    },
    _modification: function(text, mode) {
        if(mode === 'name' || mode === 'digit') {
            var index = mode === 'name' ? 0 : 1;
            this.entities.forEach(function(entity) {
                if(entity[index]) {
                    text = text.replace(entity[4], entity[index]);
                }
            });
        }

        return text;
    }
};

if(typeof exports === 'object') {
    module.exports = Typograf;
}

Typograf.prototype.entities = [];

// http://www.w3.org/TR/html4/sgml/entities
[
    ['nbsp', 160],
    ['iexcl', 161],
    ['cent', 162],
    ['pound', 163],
    ['curren', 164],
    ['yen', 165],
    ['brvbar', 166],
    ['sect', 167],
    ['uml', 168],
    ['copy', 169],
    ['ordf', 170],
    ['laquo', 171],
    ['not', 172],
    ['shy', 173],
    ['reg', 174],
    ['macr', 175],
    ['deg', 176],
    ['plusmn', 177],
    ['sup2', 178],
    ['sup3', 179],
    ['acute', 180],
    ['micro', 181],
    ['para', 182],
    ['middot', 183],
    ['cedil', 184],
    ['sup1', 185],
    ['ordm', 186],
    ['raquo', 187],
    ['frac14', 188],
    ['frac12', 189],
    ['frac34', 190],
    ['iquest', 191],
    ['Agrave', 192],
    ['Aacute', 193],
    ['Acirc', 194],
    ['Atilde', 195],
    ['Auml', 196],
    ['Aring', 197],
    ['AElig', 198],
    ['Ccedil', 199],
    ['Egrave', 200],
    ['Eacute', 201],
    ['Ecirc', 202],
    ['Euml', 203],
    ['Igrave', 204],
    ['Iacute', 205],
    ['Icirc', 206],
    ['Iuml', 207],
    ['ETH', 208],
    ['Ntilde', 209],
    ['Ograve', 210],
    ['Oacute', 211],
    ['Ocirc', 212],
    ['Otilde', 213],
    ['Ouml', 214],
    ['times', 215],
    ['Oslash', 216],
    ['Ugrave', 217],
    ['Uacute', 218],
    ['Ucirc', 219],
    ['Uuml', 220],
    ['Yacute', 221],
    ['THORN', 222],
    ['szlig', 223],
    ['agrave', 224],
    ['aacute', 225],
    ['acirc', 226],
    ['atilde', 227],
    ['auml', 228],
    ['aring', 229],
    ['aelig', 230],
    ['ccedil', 231],
    ['egrave', 232],
    ['eacute', 233],
    ['ecirc', 234],
    ['euml', 235],
    ['igrave', 236],
    ['iacute', 237],
    ['icirc', 238],
    ['iuml', 239],
    ['eth', 240],
    ['ntilde', 241],
    ['ograve', 242],
    ['oacute', 243],
    ['ocirc', 244],
    ['otilde', 245],
    ['ouml', 246],
    ['divide', 247],
    ['oslash', 248],
    ['ugrave', 249],
    ['uacute', 250],
    ['ucirc', 251],
    ['uuml', 252],
    ['yacute', 253],
    ['thorn', 254],
    ['yuml', 255],
    ['fnof', 402],
    ['Alpha', 913],
    ['Beta', 914],
    ['Gamma', 915],
    ['Delta', 916],
    ['Epsilon', 917],
    ['Zeta', 918],
    ['Eta', 919],
    ['Theta', 920],
    ['Iota', 921],
    ['Kappa', 922],
    ['Lambda', 923],
    ['Mu', 924],
    ['Nu', 925],
    ['Xi', 926],
    ['Omicron', 927],
    ['Pi', 928],
    ['Rho', 929],
    ['Sigma', 931],
    ['Tau', 932],
    ['Upsilon', 933],
    ['Phi', 934],
    ['Chi', 935],
    ['Psi', 936],
    ['Omega', 937],
    ['alpha', 945],
    ['beta', 946],
    ['gamma', 947],
    ['delta', 948],
    ['epsilon', 949],
    ['zeta', 950],
    ['eta', 951],
    ['theta', 952],
    ['iota', 953],
    ['kappa', 954],
    ['lambda', 955],
    ['mu', 956],
    ['nu', 957],
    ['xi', 958],
    ['omicron', 959],
    ['pi', 960],
    ['rho', 961],
    ['sigmaf', 962],
    ['sigma', 963],
    ['tau', 964],
    ['upsilon', 965],
    ['phi', 966],
    ['chi', 967],
    ['psi', 968],
    ['omega', 969],
    ['thetasym', 977],
    ['upsih', 978],
    ['piv', 982],
    ['bull', 8226],
    ['hellip', 8230],
    ['prime', 8242],
    ['Prime', 8243],
    ['oline', 8254],
    ['frasl', 8260],
    ['weierp', 8472],
    ['image', 8465],
    ['real', 8476],
    ['trade', 8482],
    ['alefsym', 8501],
    ['larr', 8592],
    ['uarr', 8593],
    ['rarr', 8594],
    ['darr', 8595],
    ['harr', 8596],
    ['crarr', 8629],
    ['lArr', 8656],
    ['uArr', 8657],
    ['rArr', 8658],
    ['dArr', 8659],
    ['hArr', 8660],
    ['forall', 8704],
    ['part', 8706],
    ['exist', 8707],
    ['empty', 8709],
    ['nabla', 8711],
    ['isin', 8712],
    ['notin', 8713],
    ['ni', 8715],
    ['prod', 8719],
    ['sum', 8721],
    ['minus', 8722],
    ['lowast', 8727],
    ['radic', 8730],
    ['prop', 8733],
    ['infin', 8734],
    ['ang', 8736],
    ['and', 8743],
    ['or', 8744],
    ['cap', 8745],
    ['cup', 8746],
    ['int', 8747],
    ['there4', 8756],
    ['sim', 8764],
    ['cong', 8773],
    ['asymp', 8776],
    ['ne', 8800],
    ['equiv', 8801],
    ['le', 8804],
    ['ge', 8805],
    ['sub', 8834],
    ['sup', 8835],
    ['nsub', 8836],
    ['sube', 8838],
    ['supe', 8839],
    ['oplus', 8853],
    ['otimes', 8855],
    ['perp', 8869],
    ['sdot', 8901],
    ['lceil', 8968],
    ['rceil', 8969],
    ['lfloor', 8970],
    ['rfloor', 8971],
    ['lang', 9001],
    ['rang', 9002],
    ['spades', 9824],
    ['clubs', 9827],
    ['hearts', 9829],
    ['diams', 9830],
    ['loz', 9674],
    ['OElig', 338],
    ['oelig', 339],
    ['Scaron', 352],
    ['scaron', 353],
    ['Yuml', 376],
    ['circ', 710],
    ['tilde', 732],
    ['ensp', 8194],
    ['emsp', 8195],
    ['thinsp', 8201],
    ['zwnj', 8204],
    ['zwj', 8205],
    ['lrm', 8206],
    ['rlm', 8207],
    ['ndash', 8211],
    ['mdash', 8212],
    ['lsquo', 8216],
    ['rsquo', 8217],
    ['sbquo', 8218],
    ['ldquo', 8220],
    ['rdquo', 8221],
    ['bdquo', 8222],
    ['dagger', 8224],
    ['Dagger', 8225],
    ['permil', 8240],
    ['lsaquo', 8249],
    ['rsaquo', 8250],
    ['euro', 8364]
].forEach(function(en) {
    var name = en[0],
        num = en[1],
        sym = String.fromCharCode(num),
        buf = [
            '&' + name + ';', // 0 - &nbsp;
            '&#' + num + ';', // 1 - &#160;
            sym, // 2 - \u00A0
            new RegExp('&' + name + ';', 'g'),
            new RegExp(sym, 'g') // 4
        ];

    Typograf.prototype.entities.push(buf);
}, this);

Typograf.data('common/letter', 'a-z');

Typograf.data('en/letter', 'a-z');

Typograf.data('ru/letter', 'а-яё');

Typograf.data('ru/month', [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь'
]);

Typograf.data('ru/monthCase', [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря'
]);

Typograf.data('ru/shortMonth', [
    'янв',
    'фев',
    'мар',
    'апр',
    'ма[ейя]',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек'
]);

Typograf.data('ru/weekday', [
    'понедельник',
    'вторник',
    'среда',
    'четверг',
    'пятница',
    'суббота',
    'воскресенье'
]);

Typograf.rule({
    name: 'common/html/escape',
    sortIndex: 110,
    queue: 'end',
    func: function(text) {
        var entityMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#39;',
            '/': '&#x2F;'
        };

        return text.replace(/[&<>"'\/]/g, function(s) {
            return entityMap[s];
        });
    },
    enabled: false
});

Typograf.rule({
    name: 'common/html/mail',
    sortIndex: 2000,
    func: function(text) {
        return text.replace(
            /(^|[\s;(])([\w\-.]{2,})@([\w\-.]{2,})\.([a-z]{2,6})([)\s.,!?]|$)/gi,
            '$1<a href="mailto:$2@$3.$4">$2@$3.$4</a>$5'
        );
    }
});

Typograf.rule({
    name: 'common/html/nbr',
    sortIndex: 2020,
    func: function(text) {
        return text.search(/<br/) === -1 ? text.replace(/\n/g, '<br/>\n') : text;
    },
    enabled: false
});

Typograf.rule({
    name: 'common/html/pbr',
    sortIndex: 2030,
    func: function(text) {
        if(text.search(/\n/) === -1) {
            text = '<p>' + text + '</p>';
        } else {
            text = '<p>' + text.replace(/\n\n/g, '</p>\n<p>') + '<\/p>';
            text = text.replace(/([^>])\n/g, '$1<br/>\n');
        }

        return text;
    },
    enabled: false
});

Typograf.rule({
    name: 'common/html/stripTags',
    sortIndex: 100,
    queue: 'end',
    func: function(text) {
        return text.replace(/<\/?[^>]+>/g, '');
    },
    enabled: false
});

Typograf.rule({
    name: 'common/html/url',
    sortIndex: 2010,
    func: function(text) {
        var prefix = '(http|https|ftp|telnet|news|gopher|file|wais)://',
            pureUrl = '([a-zA-Z0-9\/\\n+-=%&:_.~?]+[a-zA-Z0-9#+]*)',
            re = new RegExp(prefix + pureUrl, 'g');

        return text.replace(re, function($0, $1, $2) {
            var url = $2,
                fullUrl = $1 + '://' + $2,
                firstPart = '<a href="' + fullUrl + '">';

            if($1 === 'http') {
                url = url
                    .replace(/^www\./, '')
                    .replace(/^([^\/]+)\/$/, '$1');

                return firstPart + url + '</a>';
            }

            return firstPart + fullUrl + '</a>';
        });
    }
});

Typograf.rule({
    name: 'common/nbsp/afterNumber',
    sortIndex: 615,
    func: function(text) {
        var re = '(^|\\D)(\\d{1,5}) ([' +
            this.letters() +
            ']{2,})';

        return text.replace(new RegExp(re, 'gi'), '$1$2\u00A0$3');
    }
});

Typograf.rule({
    name: 'common/nbsp/afterPara',
    sortIndex: 610,
    func: function(text) {
        return text.replace(/§ ?(\d|I|V|X)/g, '§\u00A0$1');
    }
});

Typograf.rule({
    name: 'common/nbsp/afterShortWord', 
    sortIndex: 590,
    func: function(text, settings) {
        var len = settings.lengthShortWord,
            str = '(^| |\u00A0)([' +
                this.letters() +
                ']{1,' + len + '})(\\.?) ',
            re = new RegExp(str, 'gi');

        return text
            .replace(re, '$1$2$3\u00A0')
            .replace(re, '$1$2$3\u00A0');
    },
    settings: {
        lengthShortWord: 2
    }
});

Typograf.rule({
    name: 'common/nbsp/beforeShortLastWord',
    sortIndex: 620,
    func: function(text, settings) {
        var len = settings.lengthLastWord,
            re = new RegExp(' ([' + this.letters() + ']{1,' + len + '})(\\.|\\?|:|!|,)', 'gi');

        return text.replace(re, '\u00A0$1$2');
    },
    settings: {
        lengthLastWord: 3
    }
});

Typograf.rule({
    name: 'common/nbsp/dpi',
    sortIndex: 1150,
    func: function(text) {
        return text.replace(/(\d) ?(lpi|dpi)(?!\w)/, '$1\u00A0$2');
    }
});

(function() {

function replaceNbsp($0, $1, $2, $3) {
    return $1 + $2.replace(/([^\u00A0])\u00A0([^\u00A0])/g, '$1 $2') + $3;
}

Typograf.rule({
    name: 'common/nbsp/nowrap',
    sortIndex: 1400,
    func: function(text) {
        return text
            .replace(/(<nowrap>)(.*?)(<\/nowrap>)/g, replaceNbsp)
            .replace(/(<nobr>)(.*?)(<\/nobr>)/g, replaceNbsp);
    }
});

})();

Typograf.rule({
    name: 'common/number/fraction',
    sortIndex: 1120,
    func: function(text) {
        return text.replace(/(^|\D)1\/2(\D|$)/g, '$1½$2')
            .replace(/(^|\D)1\/4(\D|$)/g, '$1¼$2')
            .replace(/(^|\D)3\/4(\D|$)/g, '$1¾$2');
    }
});

Typograf.rule({
    name: 'common/number/plusMinus',
    sortIndex: 1010,
    func: function(text) {
        var re = new RegExp('(^| |\\>|\u00A0)\\+-(\\d)', 'g');
        return text.replace(re, '$1±$2').replace(/(^\s*)\+-(\s*$)/g, '$1±$2');
    }
});

Typograf.rule({
    name: 'common/number/times',
    sortIndex: 1050,
    func: function(text) {
        return text.replace(/(\d) ?(x|х) ?(\d)/g, '$1×$3');
    }
});

Typograf.rule({
    name: 'common/other/repeatWord',
    sortIndex: 1200,
    func: function(text) {
        var re = '([' +
            this.letters() +
            '\u0301]+) \\1([;:,.?! \n])';

        return text.replace(new RegExp(re, 'gi'), '$1$2');
    },
    enabled: false
});

Typograf.rule({
    name: 'common/punctuation/delDoublePunctuation',
    sortIndex: 580,
    func: function(text) {
        return text.replace(/(,|:|;|\?){2,}/g, '$1');
    }
});

Typograf.rule({
    name: 'common/punctuation/exclamation',
    sortIndex: 1150,
    func: function(text) {
        return text
            .replace(/(^|[^!])!{2}($|[^!])/, '$1!$2')
            .replace(/(^|[^!])!{4}($|[^!])/, '$1!!!$2');
    }
});

Typograf.rule({
    name: 'common/punctuation/exclamationQuestion',
    sortIndex: 1140,
    func: function(text) {
        var re = new RegExp('(^|[^!])!\\?([^?]|$)', 'g');
        return text.replace(re, '$1?!$2');
    }
});

Typograf.rule({
    name: 'common/punctuation/hellip', 
    sortIndex: 20, 
    func: function(text) {
        return text.replace(/(^|[^.])\.{3,4}([^.]|$)/g, '$1…$2');
    }
});

Typograf.rule({
    name: 'common/space/afterPunctuation', 
    sortIndex: 560, 
    func: function(text) {
        return text
            .replace(/(!|;|\?)([^ \uDBFF\n\t!;?[])/g, '$1 $2')
            .replace(/(\D)(,|:)([^ \uDBFF\n\t,.?:])/g, '$1$2 $3');
    }
});

Typograf.rule({
    name: 'common/space/delBeforePercent',
    sortIndex: 600,
    func: function(text) {
        return text.replace(/(\d)( |\u00A0)(%|‰|‱)/g, '$1$3');
    }
});

Typograf.rule({
    name: 'common/space/delBeforePunctuation',
    sortIndex: 550,
    func: function(text) {
        return text.replace(/ (!|;|,|\?|\.|:)/g, '$1')
            .replace(/\( /g, '(')
            .replace(/([^ ])\(/g, '$1 (')
            .replace(/ \)/g, ')')
            .replace(/\)([^!;,\?\.:])/g, ') $1');
    }
});

Typograf.rule({
    name: 'common/space/delLeadingBlanks',
    sortIndex: 504,
    func: function(text) {
        return text.replace(/\n[ \t]+/g, '\n');
    },
    enabled: false
});

Typograf.rule({
    name: 'common/space/delRepeatN',
    sortIndex: 545,
    func: function(text) {
        return text.replace(/\n{3,}/g, '\n\n');
    }
});

Typograf.rule({
    name: 'common/space/delRepeatSpace',
    sortIndex: 540,
    func: function(text) {
        return text.replace(/([^\n \t])( |\t){2,}([^\n \t])/g, '$1$2$3');
    }
});

Typograf.rule({
    name: 'common/space/delTrailingBlanks',
    sortIndex: 505,
    func: function(text) {
        return text.replace(/[ \t]+\n/g, '\n');
    }
});

Typograf.rule({
    name: 'common/space/replaceTab',
    sortIndex: 510,
    func: function(text) {
        return text.replace(/\t/g, ' ');
    }
});

Typograf.rule({
    name: 'common/space/trimLeft',
    sortIndex: 530,
    func: String.prototype.trimLeft ? function(text) {
        return text.trimLeft();
    } : function(text) {
        return text.replace(/^[\s\uFEFF\xA0]+/g, '');
    }
});

Typograf.rule({
    name: 'common/space/trimRight',
    sortIndex: 535,
    func: String.prototype.trimRight ? function(text) {
        return text.trimRight();
    } : function(text) {
        return text.replace(/[\s\uFEFF\xA0]+$/g, '');
    }
});

Typograf.rule({
    name: 'common/sym/arrow',
    sortIndex: 1130,
    func: function(text) {
        return text.replace(/(^|[^-])->(?!>)/g, '$1→').replace(/(^|[^<])<-(?!-)/g, '$1←');
    }
});

Typograf.rule({
    name: 'common/sym/cf',
    sortIndex: 1020,
    func: function(text) {
        var re = new RegExp('(\\d+)( |\u00A0)?(C|F)([\\W \\.,:!\\?"\\]\\)]|$)', 'g');

        return text.replace(re, '$1' + '\u2009' + '°$3$4');
    }
});

Typograf.rule({
    name: 'common/sym/copy',
    sortIndex: 10,
    func: function(text) {
        return text.replace(/\(r\)/gi, '®')
            .replace(/(copyright )?\((c|с)\)/gi, '©')
            .replace(/\(tm\)/gi, '™');
    }
});

Typograf._ruDashBefore = '(^| |\\n)';
Typograf._ruDashAfter = '( |,|\\.|\\?|:|!|$)';

Typograf.rule({
    name: 'ru/dash/izpod',
    sortIndex: 35,
    func: function(text) {
        var re = new RegExp(Typograf._ruDashBefore +
            '(И|и)з под' +
            Typograf._ruDashAfter, 'g');

        return text.replace(re, '$1$2з-под$3');
    }
});

Typograf.rule({
    name: 'ru/dash/izza',
    sortIndex: 33,
    func: function(text) {
        var re = new RegExp(Typograf._ruDashBefore +
            '(И|и)з за' +
            Typograf._ruDashAfter, 'g');

        return text.replace(re, '$1$2з-за$3');
    }
});

Typograf.rule({
    name: 'ru/dash/koe',
    sortIndex: 38,
    func: function(text) {
        var re = new RegExp(Typograf._ruDashBefore +
            '(К|к)ое\\s([а-яё]{3,})' +
            Typograf._ruDashAfter, 'g');

        text = text.replace(re, '$1$2ое-$3$4');
        
        var re2 = new RegExp(Typograf._ruDashBefore +
            '(К|к)ой\\s([а-яё]{3,})' +
            Typograf._ruDashAfter, 'g');

        return text.replace(re2, '$1$2ой-$3$4');
    }
});

Typograf.rule({
    name: 'ru/dash/main',
    sortIndex: 620,
    func: function(text) {
        var dashes = '(-|--|–|—)',
            settingDash = this.setting('ru/dash/main', 'dash'),
            reMain = new RegExp('( |\u00A0)' + dashes + '( |\\n)', 'g'),
            reDirect = new RegExp('(^|\n)' + dashes + '( |\u00A0)', 'g'),
            reInterval = new RegExp('(X|I|V)(?: |\u00A0)?' + dashes + '(?: |\u00A0)?(X|I|V)', 'g');

        return text
            .replace(reMain, '\u00A0' + settingDash + '$3')
            .replace(reDirect, '$1' + settingDash + '\u00A0')
            .replace(reInterval, '$1' + this.setting('ru/dash/main', 'dashInterval') + '$3');
    },
    settings: {
        dash: '\u2014', // &mdash;
        dashInterval: '\u2014' // &mdash;
    }
});

Typograf.rule({
    name: 'ru/dash/month',
    sortIndex: 610,
    func: function(text) {
        var part = '(' + this.data['ru/month'].join('|') + ')',
            re = new RegExp(part + ' ?(-|—) ?' + part, 'gi');

        return text.replace(re, '$1' + this.setting('ru/dash/main', 'dashInterval') + '$3');
    }
});

Typograf.rule({
    name: 'ru/dash/taki',
    sortIndex: 39,
    func: function(text) {
        var re = new RegExp('(верно|довольно|опять|прямо|так|всё|действительно|неужели)\\s(таки)' +
            Typograf._ruDashAfter, 'g');

        return text.replace(re, '$1-$2$3');
    }
});

Typograf.rule({
    name: 'ru/dash/to',
    sortIndex: 30,
    func: function(text) {
        var re = new RegExp('( | ?- ?)(то|либо|нибудь|ка|де|кась)' + Typograf._ruDashAfter, 'g');
        return text.replace(re, '-$2$3');
    }
});

Typograf.rule({
    name: 'ru/dash/weekday',
    sortIndex: 600,
    func: function(text) {
        var part = '(' + this.data['ru/weekday'].join('|') + ')',
            re = new RegExp(part + ' ?(-|—) ?' + part, 'gi');

        return text.replace(re, '$1' + this.setting('ru/dash/main', 'dashInterval') + '$3');
    }
});

Typograf.rule({
    name: 'ru/date/main',
    sortIndex: 1300,
    func: function(text) {
        var sp1 = '(-|\\.|\\/)',
            sp2 = '(-|\\/)',
            re1 = new RegExp('(^|\\D)(\\d{4})' + sp1 + '(\\d{2})' + sp1 + '(\\d{2})(\\D|$)', 'gi'),
            re2 = new RegExp('(^|\\D)(\\d{2})' + sp2 + '(\\d{2})' + sp2 + '(\\d{4})(\\D|$)', 'gi');
            
        return text
            .replace(re1, '$1$6.$4.$2$7')
            .replace(re2, '$1$4.$2.$6$7');
    }
});

Typograf.rule({
    name: 'ru/date/weekday',
    sortIndex: 1310,
    func: function(text) {
        var space = '( |\u00A0)',
            monthCase = this.data['ru/monthCase'].join('|'),
            weekday = this.data['ru/weekday'].join('|'),
            re = new RegExp('(\\d)' + space + '(' + monthCase + '),' + space + '(' + weekday + ')', 'gi');

        return text.replace(re, function() {
            var a = arguments;
            return a[1] + a[2] + a[3].toLowerCase() + ',' + a[4] + a[5].toLowerCase();
        });
    }
});

Typograf.rule({
    name: 'ru/money/dollar',
    sortIndex: 1140,
    func: function(text) {
        var re1 = new RegExp('(^|[\\D]{2,})\\$ ?([\\d.,]+)', 'g'),
            re2 = new RegExp('(^|[\\D])([\\d.,]+) ?\\$'),
            rep = '$1$2\u00A0$';

        return text
            .replace(re1, rep)
            .replace(re2, rep);
    }
});

Typograf.rule({
    name: 'ru/money/euro',
    sortIndex: 1140,
    func: function(text) {
        var re1 = new RegExp('(^|[\\D]{2,})€ ?([\\d.]+)', 'g'),
            re2 = new RegExp('(^|[\\D])([\\d.,]+) ?€'),
            rep = '$1$2\u00A0€';

        return text
            .replace(re1, rep)
            .replace(re2, rep);
    }
});

Typograf.rule({
    name: 'ru/money/ruble',
    sortIndex: 1145,
    func: function(text) {
        var rep = '$1\u00A0₽';
        return text
            .replace(/^(\d+)( |\u00A0)?(р|руб)\.$/, rep)
            .replace(/(\d+)( |\u00A0)?(р|руб)\.(?=[!?,:;])/g, rep)
            .replace(/(\d+)( |\u00A0)?(р|руб)\.(?=\s+[A-ЯЁ])/g, rep + '.');
    },
    enabled: false
});

Typograf.rule({
    name: 'ru/nbsp/afterNumberSign',
    sortIndex: 610,
    func: function(text) {
        return text.replace(/№ ?(\d|п\/п)/g, '№\u00A0$1');
    }
});

Typograf.rule({
    name: 'ru/nbsp/beforeParticle',
    sortIndex: 570,
    func: function(text) {
        return text.replace(/ (ли|ль|же|ж|бы|б)([^а-яёА-ЯЁ])/g, '\u00A0$1$2');
    }
});

Typograf.rule({
    name: 'ru/nbsp/but',
    sortIndex: 1110,
    func: function(text) {
        var re = new RegExp(',?( |\u00A0|\n)(а|но)( |\u00A0|\n)', 'g');
        return text.replace(re, ',$1$2$3');
    }
});

Typograf.rule({
    name: 'ru/nbsp/cc',
    sortIndex: 1090,
    func: function(text) {
        text = text.replace(/(^|\d|V|I|X) ?в(в)?( |,|;|\n|$)/g, '$1\u00A0в$2.$3');

        return text.replace(/(^|\d|[IVX]) ?в\.? ?в\./g, '$1\u00A0вв.');
    }
});

Typograf.rule({
    name: 'ru/nbsp/dayMonth',
    sortIndex: 1105,
    func: function(text) {
        var re = new RegExp('(\\d{1,2}) (' + this.data['ru/shortMonth'].join('|') + ')', 'gi');
        return text.replace(re, '$1\u00A0$2');
    }
});

Typograf.rule({
    name: 'ru/nbsp/m',
    sortIndex: 1030,
    func: function(text) {
        var m = '(км|м|дм|см|мм)',
            re2 = new RegExp('(^|\\D)(\\d+) ?' + m + '2(\\D|$)', 'g'),
            re3 = new RegExp('(^|\\D)(\\d+) ?' + m + '3(\\D|$)', 'g');

        return text
            .replace(re2, '$1$2\u00A0$3²$4')
            .replace(re3, '$1$2\u00A0$3³$4');
    }
});

Typograf.rule({
    name: 'ru/nbsp/ooo',
    sortIndex: 1100,
    func: function(text) {
        return text.replace(/(^|[^a-яёA-ЯЁ])(ООО|ОАО|ЗАО|НИИ|ПБОЮЛ) /g, '$1$2\u00A0');
    }
});

Typograf.rule({
    name: 'ru/nbsp/page',
    sortIndex: 610,
    func: function(text) {
        return text.replace(/ (стр|гл|рис|илл)\./g, '\u00A0$1.');
    }
});

Typograf.rule({
    name: 'ru/nbsp/xxxx',
    sortIndex: 1060,
    func: function(text) {
        return text.replace(/(^|\D)(\d{1,4}) ?г(од| |,|;|\.|\n|$)/g, '$1$2\u00A0г$3');
    }
});

Typograf.rule({
    name: 'ru/nbsp/yy',
    sortIndex: 1080,
    func: function(text) {
        return text.replace(/(^|\d) ?г\. ?г\./g, '$1\u00A0гг.');
    }
});

Typograf.rule({
    name: 'ru/number/ordinals',
    sortIndex: 1300,
    func: function(text) {
        return text
            .replace(/(\d)-(ый|ой)([^а-яё]|$)/g, '$1-й$3')
            .replace(/(\d)-ая([^а-яё]|$)/g, '$1-я$2')
            .replace(/(\d)-(ое|ые)([^а-яё]|$)/g, '$1-е$3')
            .replace(/(\d)-(ым|ом)([^а-яё]|$)/g, '$1-м$3')
            .replace(/(\d)-ых([^а-яё]|$)/g, '$1-х$2')
            .replace(/(\d)-ого([^а-яё]|$)/g, '$1-го$2')
            .replace(/(\d)-ому([^а-яё]|$)/g, '$1-му$2')
            .replace(/(\d)-ыми([^а-яё]|$)/g, '$1-ми$2');
    }
});

/*jshint maxlen:1000 */
Typograf.rule({
    name: 'ru/optalign/bracket',
    sortIndex: 1001,
    func: function(text, settings) {
        return text
            .replace(/( |\u00A0)\(/g, '<span class="typograf-oa-sp-lbracket">$1</span><span class="typograf-oa-lbracket">(</span>')
            .replace(/(^|\n)\(/g, '$1<span class="typograf-oa-n-lbracket">(</span>');
    },
    enabled: false
})
.innerRule({
    name: 'ru/optalign/bracket',
    func: function(text) {
        // Зачистка HTML-тегов от висячая пунктуация для скобки
        return text.replace(/<span class="typograf-oa-(sp-lbracket|lbracket|n-lbracket)">(.*?)<\/span>/g, '$2');
    }
});

/*jshint maxlen:1000 */
Typograf.rule({
    name: 'ru/optalign/comma',
    sortIndex: 1002,
    func: function(text, settings) {
        return text.replace(/([а-яёa-z0-9\u0301]+)\, /gi, '$1<span class="typograf-oa-comma">,</span><span class="typograf-oa-comma-sp"> </span>');
    },
    enabled: false
})
.innerRule({
    name: 'ru/optalign/comma',
    func: function(text) {
        // Зачистка HTML-тегов от висячей пунктуации для запятой
        return text.replace(/<span class="typograf-oa-(comma|comma-sp)">(.*?)<\/span>/g, '$2');
    }
});

/*jshint maxlen:1000 */
Typograf.rule({
    name: 'ru/optalign/quot',
    sortIndex: 1000,
    func: function(text, settings) {
        var quotes = '(' + this.setting('ru/punctuation/quot', 'lquot') + '|' + this.setting('ru/punctuation/quot', 'lquot2') + ')',
            re = new RegExp('([a-zа-яё\\-\u0301]{3,})( |\u00A0)(' + quotes + ')', 'gi'),
            re2 = new RegExp('(^|\n|<p> *)' + quotes, 'g');

        return text
            .replace(re, '$1<span class="typograf-oa-sp-lquot">$2</span><span class="typograf-oa-lquot">$3</span>')
            .replace(re2, '$1<span class="typograf-oa-n-lquot">$2</span>');
    },
    enabled: false
})
.innerRule({
    name: 'ru/optalign/quot',
    func: function(text) {
        // Зачистка HTML-тегов от висячей пунктуации для кавычки
        return text.replace(/<span class="typograf-oa-(sp-lquot|lquot|n-lquot)">(.*?)<\/span>/g, '$2');
    }
});

Typograf.rule({
    name: 'ru/other/accent', 
    sortIndex: 560,
    enabled: false,
    func: function(text) {
        return text.replace(/([а-яё])([АЕЁИОУЫЭЮЯ])([^А-ЯЁ\w]|$)/g, function($0, $1, $2, $3) {
           return $1 + $2.toLowerCase() + '\u0301' + $3;
        });
    }
});

Typograf.rule({
    name: 'ru/punctuation/quot',
    sortIndex: 700,
    func: function(text, settings) {
        var letter = '[\\w\\dа-яёА-ЯЁ\u0301]',
            tag = '(?:^|<\\w.*?>)*',
            lquot = settings.lquot,
            rquot = settings.rquot,
            lquot2 = settings.lquot2,
            rquot2 = settings.rquot2,
            phraseL = '(?:…|' + letter + '|\\n)',
            phraseR = '(?:' + [letter, '[)!?.:;#*,]'].join('|') + ')*',
            quotesL = '(«|„|“|")',
            quotesR = '(»|”|“|")',
            reL = new RegExp('(' + tag + ')?' + quotesL + '(' + tag + phraseL + tag + ')', 'g'),
            reR = new RegExp('(' + tag + phraseR + tag + ')' + quotesR + '(' + phraseR + ')', 'g'),
            re2, reL2, reR2;

        text = text
            .replace(reL, '$1' + lquot + '$3') // Открывающая кавычка
            .replace(reR, '$1' + rquot + '$3') // Закрывающая кавычка
            .replace(new RegExp('(^|\\w|\\s)' + rquot + lquot, 'g'),
                '$1' + lquot + lquot); // фикс для случая »« в начале текста

        if(lquot === lquot2 && rquot === rquot2) {
            text = text
                .replace(new RegExp(lquot + lquot, 'g'), lquot) // ««Энергия» Синергия» -> «Энергия» Синергия»
                .replace(new RegExp(rquot + rquot, 'g'), rquot); // «Энергия «Синергия»» -> «Энергия «Синергия»
        } else {
            re2 = new RegExp('(' + lquot + ')([^' + rquot + ']*?)' + lquot +
                '(.*?)' + rquot + '([^' + lquot + ']*?)(' + rquot + ')', 'g');
            reL2 = new RegExp('(' + lquot2 + ')(.*?)' + lquot + '(.*?)(' + rquot2 + ')', 'g');
            reR2 = new RegExp('(' + lquot2 + ')(.*?)' + rquot + '(.*?)(' + rquot2 + ')', 'g');

            text = text
                .replace(re2, '$1$2' + lquot2 + '$3' + rquot2 + '$4$5') // Предварительная расстановка вложенных кавычек
                .replace(reL2, '$1$2' + lquot2 + '$3$4') // Вложенная открывающая кавычка
                .replace(reR2, '$1$2' + rquot2 + '$3$4'); // Вложенная закрывающая кавычка
        }

        return text;
    },
    settings: {
        lquot: '«',
        rquot: '»',
        lquot2: '„',
        rquot2: '“'
    }
});

Typograf._sortRules();
Typograf._needSortRules = true;
