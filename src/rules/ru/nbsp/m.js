Typograf.rule({
    title: 'm2 → м², m3 → м³ и неразрывный пробел',
    name: 'ru/nbsp/m',
    sortIndex: 1030,
    func: function(text) {
        var m = '(км|м|дм|см|мм)',
            re2 = new RegExp('(^|\\D)(\\d+) ?' + m + '2(\\D|$)', 'g'),
            re3 = new RegExp('(^|\\D)(\\d+) ?' + m + '3(\\D|$)', 'g');

        text = text.replace(re2, '$1$2\u00A0$3²$4');
        
        return text.replace(re3, '$1$2\u00A0$3³$4');
    }
});
