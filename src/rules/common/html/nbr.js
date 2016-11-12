Typograf.rule({
    name: 'common/html/nbr',
    index: '+5',
    queue: 'end',
    handler: function(text) {
        return text.replace(/([^\n>])\n(?=[^\n])/g, '$1<br/>\n');
    },
    disabled: true
});
