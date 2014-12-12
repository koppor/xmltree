/* ==============
The MIT License (MIT)

Copyright (c) 2011-2013 Mitya <mitya@mitya.co.uk>
Copyright (c) 2013 Oliver Kopp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

| @author: Mitya <mitya@mitya.co.uk>
| @Docs & demo: http://www.mitya.co.uk/scripts/XML-Tree---visualise-and-traverse-your-XML-186
|
| github page: http://www.github.com/koppor/xmltree
============== */

// AMD and non-AMD compatibility inspired by http://tkareine.org/blog/2012/08/11/why-javascript-needs-module-definitions/ and https://github.com/blueimp/jQuery-File-Upload/blob/9.5.0/js/jquery.fileupload.js
(function(factory) {
  if (typeof define === 'function' && define.amd) {
    // Register as named AMD module. Anonymous registering causes "Mismatched anonymous define() module" in requirejs 2.9.1 when script is loaded explicitly and then loaded with requirejs
    define("xmltree", ['jquery'], factory);
  } else {
    // traditional browser loading: build object with directly referencing the global jQuery object and inject it into window object
    // "XMLTree" is used to provide backwards compatiblity with XMLTree 3.0.0
    window.XMLTree = factory(window.jQuery);
  }
}(function($) {

	//log progress?
	var log = location.href.indexOf('XMLTreeLog=true') != -1;

	XMLTree = function(jdo, subTreeRequest) {

		/* -------------------
		| PREP & VALIDATION
		------------------- */

		if (location.href.indexOf('debug') != -1) this.debug = true;

		//ensure was instantiated, not merely called
		if (!(this instanceof XMLTree)) {
			debug("XMLTree was called but not instantiated");
			return;
		}

		//validate some params
		var error;
		if (!jdo.fpath && !jdo.xml) error = "neither XML nor path to XML file passed";
		else if ((!jdo.container || !$(jdo.container).length) && !jdo.justReturn) error = "No container selector passed or does not match element in DOM";
		if (error) { alert('XMLTree error - '+error); return; }

		//some vars
		var	li,
			appendTo,
			attrLI,
			container = $(jdo.container),
			thiss = this,
			fpath_req;

		//establish tree container - if making the outer tree, create a new UL. If this is a sub-tree request, i.e. called by self,
		//merge new tree into existing UL of caller LI
		this.tree = !subTreeRequest ? $('<ul>') : container.children('ul').hide();

		//log this instance of the tree and update global instances tracker
		this.instanceID = XMLTree.instancesCounter;
		this.tree.attr('id', 'tree_'+this.instanceID);
		XMLTree.instancesCounter++;

		//add a few classes to tree, unless it's a sub-tree (i.e. being inserted later into branch of master tree, in which case it can
		//just inherit master tree's classes
		if (!subTreeRequest) {
			this.tree.addClass('xmltree');
			if (jdo['class']) this.tree.addClass(jdo['class']);
			if (jdo.startExpanded) this.tree.addClass('startExpanded');
		}

		//and any data?
		if (jdo.data) for (var i in jdo.data) this.tree.data(i, jdo.data[i]);

		//if it is a sub-tree request, add .forcePlusMin to tree (i.e. expanded LI) so plus/min icon of sub-tree shows, doesn't inherit
		//CSS from parent to hide it
		if (subTreeRequest) this.tree.addClass('forcePlusMin');

		//insert master UL, unless just returning tree, not inserting it
		if (!jdo.justReturn) this.tree.appendTo(container);


		/* -------------------
		| ESTABLISH XML - either from file or passed manually. If latter, temporarily rename all tags so any sharing names of self-
		| closing HTML tags aren't mullered by jQuery during delving
		------------------- */

		//get XML from file ('done' handler fires not here but slightly further down)
		if (jdo.fpath) {

			debug('XML tree fpath:', jdo.fpath);

			//get data...
			var dataType = !jdo.jsonp ? (!jdo.json ? 'xml' : 'json') : 'jsonp';
			fpath_req = $.ajax({url: jdo.fpath, cache: jdo.cache == undefined ? true : jdo.cache, dataType: dataType})

				//...success. Establish XML. If jdo.json, convert JSON respone to XML text then reinitialise
				.done(function(data) {
					if (jdo.json) {
						if (jdo.jsonCallback) data = jdo.jsonCallback(data);
						delete jdo.fpath;
						jdo.xml = json_to_xml(data);
						return new XMLTree(jdo, subTreeRequest);
					} else {
						data = cleanXML(data);
					}
					thiss.xml = data;
					actOnXML.call(thiss, data);
				})

				//...error
				.error(function() { alert('XMLTree error - could not load XML from '+jdo.fpath); });

		//passed as string
		} else {
			if (typeof jdo.xml == 'string') {

				this.xml = cleanXML(jdo.xml);

				//also strip out entities as they break JS XML parsing
				//this.xml = this.xml.replace(/&amp;|&(?= )/g, 'and').replace(/&\w+;/g, '');

				actOnXML.call(this);
			} else {
				alert('XMLTree error - jdo.xml is not a string');
			}
		}

		/**
		 * Does some XML cleaning
		 */
		function cleanXML(xml) {
			// just strip xml processing instruction
			return xml.replace(/<\?xml[^>]+>\s*/, '');
		}

		/* -------------------
		| ACT ON XML - once we have the XML, start outputting from it. If XML is string, first parse.
		------------------- */

		function actOnXML() {

			var thiss = this;

			//establish XML (parsing as required) as a jQuery object
			this.xml = $(typeof this.xml == 'string' ? parseXML(this.xml) : this.xml);

			//if is sub-tree request, we don't want the root, just the items
			if (subTreeRequest) this.xml = this.xml.children(':first');

			//perform any XML manipulation rules stipulated
			if (jdo.XMLCallback) this.xml = jdo.XMLCallback(this.xml);

			debug('XML fed to XMLTree:', this.xml);

			//open the tree at a specific point once output? Log as attribute on the XML node, so later we can spot this and
			//open from that point
			if (jdo.openAtPath) { var currSel = this.xml.find(jdo.openAtPath); if (currSel.length == 1) currSel.attr('currSel', 'true'); }

			//start delving. Since JS seems to add another, outer root element, our (real) root it is child
			this.xml.children().each(function() { delve($(this), thiss.tree); });

			//if sub-tree, if we ended up with no data, remove tree and also corresponding plus/min. Else show tree.
			if (subTreeRequest) this.xml.children().length ? this.tree.show() : this.tree.prev('.plusMin').andSelf().remove();

			//do post-build stuff after delving complete
			postBuild.call(this);
		}


		/* -------------------
		| MAIN FUNC for outputting. Called recursively for all levels of tree
		------------------- */

		function delve(node, appendTo) {

			var tagName, li, ul, attrs, i, kids, storedProcedure, LITxtHolder;

			//what's this node's tag name?
			tagName = node[0].tagName;

			//build LI and sub-UL for this node (note, tagname is applied as class to LI, for easy post-tree traversal)
			appendTo.append((li = $('<li>').addClass(tagName).append(LITxtHolder = $('<span>').addClass('LIText')).append(ul = $('<ul>'))));

			//plus/mins indicator
			li.append($('<span>', {html: jdo.startExpanded ? '-' : '+'}).addClass('plusMin expanded'));

			//attributes...
			attrs = node[0].attributes;

			//...add node attributes as classes? If true, all, else if array, only attributes specified in that array
			//For each eligible attribute, two classes are added: attr and attr-value
			if (jdo.attrsAsClasses) {
				for (i=0; i<attrs.length; i++)
					if (jdo.attrsAsClasses === true || (typeof jdo.attrsAsClasses == 'string' && jdo.attrsAsClasses == attrs[i].name) || (jdo.attrsAsClasses instanceof Array && $.inArray(attrs[i].name, jdo.attrsAsClasses) != -1))
						li.addClass(attrs[i].name+'-'+attrs[i].value+' '+attrs[i].name);
			}

			//...add node attributes as element data? " " " " " " "
			if (jdo.attrsAsData) {
				for (var i=0; i<attrs.length; i++)
					if (jdo.attrsAsData === true || (typeof jdo.attrsAsData == 'string' && jdo.attrsAsData == attrs[i].name) || (jdo.attrsAsData instanceof Array && $.inArray(attrs[i].name, jdo.attrsAsData) != -1))
						li.attr('data-'+attrs[i].name, attrs[i].value);
			}

			//...output attributes as LIs? (yes, no, or yes but hidden)
			if (!jdo.attrs || jdo.attrs != 'ignore') {
				if (attrs) {
					for(i=0; i<attrs.length; i++) {
						if (attrs[i].value) {
							ul.append(attrLI = $('<li>').append($('<span>', {text: attrs[i].value}).addClass('attrValue')).addClass('attr '+attrs[i].name).prepend($('<span>', {text: '@'+attrs[i].name+':'})));
							if (jdo.attrs && jdo.attrs == 'hidden') attrLI.hide();
						}
					}
				}
			} else
				attrs = false;

			//node has children? (for current purposes, attributes are considered children). If contains only attributes, and jdo.attrs
			//== 'hidden', count as having no kids
			kids = node.children();
			if (!kids.length && (!attrs.length || (attrs.length && jdo.attrs && jdo.attrs == 'hidden'))) li.addClass('noKids');

			//span to show node name
			tagName = $('<span>', {text: tagName}).addClass('tree_node');

			//if no children, simply append text (if any)
			if (!kids.length)
				LITxtHolder.prepend(node.immediateText()).prepend(tagName);

			//if children, set stored procedures that will run and create them only when branch expanded - unless starting expanded
			//or if tree involves sub-trees
			else {
				LITxtHolder.prepend(node.immediateText()+(!jdo.noDots ? '..' : '')).prepend(tagName);
				storedProcedure = (function(kids, parent) { return function() {
					kids.each(function() { delve($(this), parent); });
					if (jdo.renderCallback) jdo.renderCallback(parent, this, subTreeRequest);
				}; })(kids, ul);
				if (!jdo.startExpanded && !jdo.subTreeBranches) {
					li.children('.plusMin').bind('click.sp', function() {
						storedProcedure();
						$(this).unbind('click.sp');
					});
				} else
					storedProcedure();

			}

		}


		/* -------------------
		| POST BUILD stuff, e.g. click events, any user-defined HTML rules, update hash log in URL etc
		------------------- */

		function postBuild() {

			//if doing sub-tree requests, ensure relevent branches always have plus-min icons visible
			if (jdo.subTreeBranches) {
				if (jdo.subTreeBranches === true)
					this.tree.addClass('subTreeRequestsOnAllNodes');
				else
					this.tree.find(jdo.subTreeBranches).addClass('subTreeNode');
			}

			//listen for clicks to expand/collapse nodes.

			this.tree.on('click', '.plusMin', function(evt) {

				//prep
				evt.stopPropagation();
				var
				uls = $(this).parent().children('ul'),
				currState = $(this).is('.collapsed') ? 'closed' : 'open',
				xPathToNode = returnXPathToNode($(this).parent()),
				li = $(this).parent();
				uls[currState == 'closed' ? 'show' : 'hide']();

				//Plus/min click callback? Pass LI, LI's XPath, event obj. and string 'open' or 'close'
				if (jdo.plusMinCallback) jdo.plusMinCallback(li, xPathToNode, evt, currState);

				//Sub-tree request on expand? This should be a callback that returns a request URI that will load a sub-tree into
				//the current branch. Callback receives same args as plusMinCallback above. If data previously fetched (denoted
				//by data element on node), ignore.

				if (jdo.subTreeBranches && (jdo.subTreeBranches === true || $(this).parent().is('.subTreeNode')) && jdo.subTreeRequest && currState == 'closed' && !li.data('subTreeDataFetched')) {
					var subTreeReqURI = jdo.subTreeRequest(li, xPathToNode, evt, currState);
					if (subTreeReqURI && typeof subTreeReqURI == 'string') {
						var tree = new XMLTree($.extend(jdo, {fpath: subTreeReqURI, container: li}), true);
						if (tree) li.data('subTreeDataFetched', true);
					}
				}

				//Flip plus/minus indicator and class
				$(this).html(currState == 'closed' ? '-' : '+').removeClass('expanded collapsed').addClass(currState == 'closed' ? 'expanded' : 'collapsed');

				//Log curr tree pos in URL hash, made up of comma-sep LI indexes of open ULs (LIs with multiple open ULs are sub-sep by -)
				if (!jdo.noURLTracking) {
					var paths = [];
					thiss.tree.find('ul:visible').filter(function() { return !$(this).find('ul:visible').length; }).each(function() {
						var thisPathIndecies = [];
						$(this).parents('li').each(function() { thisPathIndecies.unshift($(this).index()); });
						paths.push(thisPathIndecies.join(','));
					});
					var newTreeHash = 'tree'+thiss.instanceID+':'+paths.join('|')+';'
					// idea by http://stackoverflow.com/a/5257214/873282
					var replaced = false;
					var regExp = new RegExp('tree'+thiss.instanceID+':([0-9,\-\|]+);');
					var newHash = location.hash.replace(regExp, function(token){replaced = true; return newTreeHash;});
					if (!replaced) {
						// no match, just append
						if (newHash.indexOf(";", newHash.length - 1) !== -1) {
							// newHash ends with ";" -> just append newTreeHash
							newHash = newHash + newTreeHash;
						} else {
							// ";" needed as separator
							newHash = newHash + ";" + newTreeHash;
						}
					}
					location.hash = newHash;
				}

			})

			//do callback on click to actual nodes? Pass LI, LI's xPath and event obj.
			if (jdo.clickCallback)
				this.tree.on('click', '.LIText', function(evt) {
					var li = $(this).closest('li'); jdo.clickCallback(li, returnXPathToNode(li), evt);
				});

			//hide attrs if params say so
			if (jdo.hideAttrs && !jdo.subTree) this.tree.addClass('hideAttrs');

			//hide node names, if params say so
			if (jdo.hideNodeNames && !jdo.subTree) this.tree.addClass('hideNodeNames');

			//render callback?
			if (jdo.renderCallback) jdo.renderCallback(this.tree, this, subTreeRequest);

			//onload - re-entry point(s) stipulated in URL hash or in params (@openAtPath)?

			//...stipulated in hash
			var paths = new RegExp('tree'+this.instanceID+':([0-9,\-\|]+);').exec(location.hash);
			if (paths) {
				var paths = paths[1].split('|');
				for(var y in paths) {
					var parts = paths[y].split(',');
					var selStr = [];
					for(var i in parts) selStr.push('li:eq('+parts[i]+') > ul');
					this.tree.find(selStr.join(' > ')).parents('ul').andSelf().show().each(function() {
						$(this).parent().children('.plusMin').html('-');
					});
				}

			//...stipulated in params
			} else
				this.tree.find('.currSel').parentsUntil('.xmltree').show();

		}

		//return tree, in case it was assigned
		return this.tree;

	}

	//count instances. Used for assigning unique IDs
	XMLTree.instancesCounter = 0;


	/* -------------------
	| UTILS
	------------------- */

	//parse XML
	function parseXML(XMLStr) {
		if (window.DOMParser) {
			parser=new DOMParser();
			xmlDoc=parser.parseFromString(XMLStr,"text/xml");
		} else {
			xmlDoc=new ActiveXObject("Microsoft.XMLDOM");
			xmlDoc.async=false;
			xmlDoc.loadXML(XMLStr);
		}
		return xmlDoc;
	}

	//get immediate text
	$.fn.immediateText = function() { return $(this).clone().children().remove().end().text(); }

	//XPath - return XPath of clicked node
	function returnXPathToNode(nodeEl) {
		var path = [];
		nodeEl.parents('li').andSelf().each(function() {
			var nodeName = $(this).children('.LIText').children('.tree_node').text();
			var step = nodeName;
			// The li element has the nodename attached as class.
			// If nodes have a QName with a namespace prefix, that class cannot be queried
			// Therefore, we have to check the grandchild of each li element
			var numberOfSilblings = $(this).siblings().filter(function() { return $(this).children('.LIText').children('.tree_node').text() == nodeName; }).length;
			if (numberOfSilblings != 0) {
				// more than one child with the same name -- we have to add an index
				var index = $(this).prevAll().filter(function() { return $(this).children('.LIText').children('.tree_node').text() == nodeName; }).length + 1;
				step += '['+index+']';
			}
			path.push(step);
		 });
		return "/" + path.join('/');
	}

	//debug (console.log)
	function debug() { if (window.console && console.log && log) for (var i in arguments) console.log(arguments[i]); }


	/* ---
	| JSON > XML convertor (creates XML string)
	--- */

	function json_to_xml(obj, root_name, depth) {

		//prep
		var xml = '', depth = depth || 0, root_name = root_name || 'root';
		if (!depth) xml = '<'+root_name+'>';

		//recurse over passed object (for-in) or array (for)
		if (obj.toString() == '[object Object]') for (var i in obj) xml += build_node(i, obj[i]);
		else if (obj instanceof Array) for (var i=0, len = obj.length; i<len; i++) xml += build_node('node', obj[i]);

		//util to build individual XML node. Tags named after object key or, if array, 'node'. Coerce tag name to be valid.
		function build_node(tag_name, val) {
			var
			tag_name = tag_name.replace(/[^\w\-_]/g, '-').replace(/-{2,}/g, '-').replace(/^[^a-z]/, function($0) { return 'node-'+$0; }),
			padder = new Array(depth + 2).join('\t'),
			node = '\n'+padder+'<'+tag_name+'>\n'+padder+'\t';
			node += typeof val != 'object' ? val : json_to_xml(val, null, depth + 1);
			return node + '\n'+padder+'</'+tag_name+'>\n';
		}

		if (!depth) xml += '</'+root_name+'>';

		//return XML string, cleaning it up a bit first
		return xml
			.replace(/&(?= )/g, '&amp;')
			.replace(/^\n(?=<)/, '')
			.replace(/\n{2,}/g, '\n')
			.replace(/^\t+\n/mg, '');
	}

	return XMLTree;
}));
