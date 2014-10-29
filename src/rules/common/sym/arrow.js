Typograf.rule({
    title: '-> → →, <- → ←',
    name: 'common/sym/arrow',
    sortIndex: 1130,
    func: function(text) {
        return text.replace(/(^|[^-])->(?!>)/g, '$1→').replace(/(^|[^<])<-(?!-)/g, '$1←');
    }
});
