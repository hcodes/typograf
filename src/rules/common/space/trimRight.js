Typograf.rule({
    name: 'common/space/trimRight',
    sortIndex: 535,
    func: String.prototype.trimRight ? function(text) {
        return text.trimRight();
    } : function(text) {
        return text.replace(/[\s\uFEFF\xA0]+$/g, '');
    }
});
