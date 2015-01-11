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
