Typograf.rule({
    title: 'Неразрывный пробел после короткого слова',
    name: 'common/nbsp/afterShortWord', 
    sortIndex: 590,
    func: function(text, settings) {
        var len = settings.lengthShortWord,
        re = new RegExp('( [\\w]{1,' + len + '}) ', 'g');

        return len > 0 ? text.replace(re, '$1\u00A0') : text;
    },
    settings: {
        lengthShortWord: 2
    }
});
