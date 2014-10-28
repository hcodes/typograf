Typograf.rule({
    title: 'x → ×',
    name: 'sym/times',
    sortIndex: 1050,
    func: function(text) {
        return text.replace(/(\d) ?(x|х) ?(\d)/g, '$1×$3');
    }
});
