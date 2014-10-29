Typograf.rule({
    title: 'Удаление двойной пунктуации',
    name: 'common/delDoublePunctiation',
    sortIndex: 580,
    func: function(text) {
        return text.replace(/(,|:|;|\?){2,}/g, '$1');
    }
});
