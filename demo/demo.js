/* TODO
   General: 
   -- need to work out unified strategy for tooltips across all visualisations
      Maybe jQuery UI?
   -- need to work out strategy for CSS across visualisations
      either separate CSS files or shared CSS files
   -- think about how the visualisations interact with embedded page. 
      ie how does MRS locate the input text to highlight it. 
      Maybe have set of standardised IDs that the user can choose to create divs with

   tree.js
   -- switch to using svg.js
   -- short labels when available
   -- incorporate types when available

  demo.html
   -- input text follows scrolling down the page?

 */

var ERG_URL = 'http://erg.delph-in.net/rest/0.9/parse';

// Renders pre-fetched ERG call so don't need to keep hitting the delph-in server
// during development.
var DEV_MODE = false;


// Using underscore.js/lodash.js  Templates
var Templates = {};

Templates.result = [
    '<div class="result">',
        '<div class="result-inner">',
            '<div class="num"><%= resultNum %></div>',
        '</div>',
    '</div>'].join("\n");


Templates.viz = [
    '<div class="viz <%= vizType %>" data-viz="<%= vizType %>">',
        '<div class="tools hidden">',
            '<div title="Save as PNG" class="save" data-img="png"><div class="icon"></div><div>PNG</div></div>',
            '<div title="Save as SVG" class="save" data-img="svg"><div class="icon"></div><div>SVG</div></div>',
        '</div>',
    '</div>'
].join("\n");


Templates.successStatus = [
    '<p id="parse-status">Showing <%= numResults %> of <%= readings %> analyses.</p>',
    '<div id="text-input"><%= input %></div>'
].join("\n");


// Precompile the templates
for (var template in Templates) {
    if (Templates.hasOwnProperty(template)) {
        Templates[template] = _.template(Templates[template]);
    }
}


function Result(result, parent) {
    var resultNum = result['result-id'] + 1;

    // Create and attach the DOM element that will contain the Result
    var $result = $(Templates.result({'resultNum': resultNum})).appendTo(parent);
    
    // Create this object
    var self = {
        data : result,
        num : resultNum,
        element: $result[0],
        saveViz : function(){},
        saveVizSvg : function(vizType) {
            var svgData = self[vizType].outerHTML;
            var svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            var DOMURL = window.URL || window.webkitURL || window;
            var url = DOMURL.createObjectURL(svgBlob);
            triggerDownload(url, 'delphin.svg');        
        },
        saveVizPng : function(vizType) {
            // Save SVG to a canvas
            var svg = self[vizType];
            var canvas = $('<canvas>')[0];
            var ctx = canvas.getContext('2d');
            var bbox = svg.getBBox();
            ctx.canvas.height = bbox.height;
            ctx.canvas.width = bbox.width;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // convert SVG to dataUrl
            var data = (new XMLSerializer()).serializeToString(svg);
            var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
            var DOMURL = window.URL || window.webkitURL || window;
            var url = DOMURL.createObjectURL(svgBlob);

            var img = new Image();
            img.onload = function () {
                ctx.drawImage(img, 0, 0);
                DOMURL.revokeObjectURL(url);

                var imgURI = canvas
                        .toDataURL('image/png')
                        .replace('image/png', 'image/octet-stream');

                // on the image load, actually download it
                triggerDownload(imgURI, 'delphin.png');
            };
            img.src = url;
        }
    };
    
    var $inner = $result.find('.result-inner');

    // Add data structures as per the available data
    if (self.data.derivation) {
        var $viz = $(Templates.viz({vizType:'tree'})).appendTo($inner);
        self.tree = drawTree($viz[0], self.data.derivation);
    }
    
    if (self.data.mrs) {
        var $viz = $(Templates.viz({vizType:'mrs'})).appendTo($inner);
        self.mrs = MRS($viz[0], self.data.mrs);
    }

    //Add various event bindings to things in the visualisations
    $result.find('.viz').hover(
        function(event) {
            $(this).find('.tools').removeClass('hidden');
        },
        function(event) {
            $(this).find('.tools').addClass('hidden');
        }
    ).each(function(index) {
        var vizType = this.dataset.viz;
        $(this).find('.save').click(function(event){
            if (this.dataset.img == 'svg')
                self.saveVizSvg(vizType);
            else if (this.dataset.img == 'png')
                self.saveVizPng(vizType);
        });
    });

    // Return this object
    return self;
}


function triggerDownload (imgURI, filename) {
    var evt = new MouseEvent('click', {
        view: window,
        bubbles: false,
        cancelable: true
    });

    var a = document.createElement('a');
    a.setAttribute('download', filename);
    a.setAttribute('href', imgURI);
    a.setAttribute('target', '_blank');
    a.dispatchEvent(evt);
}


function doResults(data){
    var results = data.results;

    // Update the status 
    $(Templates.successStatus({
        'input': data.input,
        'readings': data.readings,
        'numResults': results.length}))
        .appendTo($('#results-info').empty());
    
    //Create and add the results
    var parent = $('#results-container').empty()[0];
    
    for (var i=0; i < results.length; i++) {
        var result = Result(results[i], parent);
    }
}


$(document).ready(function(){

    $('#input-submit').click(function(event) {
        $.ajax({
            url: ERG_URL,
            dataType: 'json',
            data: {
                'derivation': 'json',
                'mrs': $('#input-mrs').prop('checked') ? 'json' : null,
                'input': $('#input-text').val(),
                'results': $('#input-results').val()
            },
            success: function(data){
                doResults(data);
            },
            error: function(data){
                alert("Error");
            }
        });
    });

    if (DEV_MODE) {
        $.getJSON("elephant.json", function(data) {
            doResults(data);
        });
    }
});
