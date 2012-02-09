/* ==============
| XMLTREE.JS
| @author: Mitya (acroxall@espresso.co.uk)
| @Docs & demo: http://www.mitya.co.uk/scripts/XML-Tree---visualise-and-traverse-your-XML-186
============== */

(function($) {

	XMLTree = function(jdo, subTreeRequest) {

		/* -------------------
		| PREP & VALIDATION
		------------------- */

		//ensure was instantiated, not merely called
		if (!(this instanceof XMLTree)) {
			if (window.console && console.log) console.log("XMLTree was called but not instantiated");
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
			rand = Math.floor(Math.random() * 10000000),
			thiss = this;

		//establish tree container - if making the outer tree, create a new UL. If this is a sub-tree request, i.e. called by self,
		//merge new tree into existing UL of caller LI
		this.tree = !subTreeRequest ? $('<ul>') : container.children('ul');

		//log this instance of the tree and update global instances tracker
		this.instanceID = XMLTree.instancesCounter;
		XMLTree.instancesCounter++;

		//add a few classes to tree, unless it's a sub-tree (i.e. being inserted later into branch of master tree, in which case it can
		//just inherit master tree's classes
		if (!subTreeRequest) {
			this.tree.addClass('xmltree');
			if (jdo.startExpanded) this.tree.addClass('startExpanded');
		}

		//if it is a sub-tree request, add .forcePlusMin to tree (i.e. expanded LI) so plus/min icon of sub-tree shows, doesn't inherit
		//CSS from parent to hide it
		if (subTreeRequest) this.tree.addClass('forcePlusMin');

		//insert master UL, unless just returning tree, not inserting it
		if (!jdo.justReturn) this.tree.appendTo(container);


		/* -------------------
		| ESTABLISH XML - either from file or passed manually. If latter, temporarily rename all tags so any sharing names of self-
		| closing HTML tags aren't mullered by jQuery during delving
		------------------- */

		//load file
		if (jdo.fpath)
			$.ajax({url: jdo.fpath, cache: jdo.cache == undefined ? true : jdo.cache, dataType: !jdo.jsonp ? 'xml' : 'jsonp'})
				.done(function(xml) { thiss.xml = xml; thiss.actOnXML(xml); })
				.error(function() { alert('XMLTree error - could not load XML from '+jdo.fpath); });

		//passed as string
		else {
			if (typeof jdo.xml == 'string')

				//rename tags
				this.xml = jdo.xml
					.replace(/<(\/)?(\w+)([^>]*)>/g, function($0, $1, $2, $3) { return '<'+($1 ? $1 : '')+$2+'_'+rand+($3 ? $3 : '')+'>'; })
					.replace(/<\?xml[^>]+>\s*/, '');
			this.actOnXML(jdo.xml);
		}


		/* -------------------
		| ACT ON XML - once we have the XML, start outputting from it. If XML is string, first parse.
		------------------- */

		XMLTree.prototype.actOnXML = function(xml) {

			var thiss = this;

			//establish XML (parsing as required) as a jQuery object
			this.xml = $(typeof xml == 'string' ? parseXML(xml) : xml);

			//if is sub-tree request, we don't want the root, just the items
			if (subTreeRequest) this.xml = this.xml.children(':first');

			//perform any XML manipulation rules stipulated
			if (jdo.XMLCallback) this.xml = jdo.XMLCallback(this.xml);

			//open the tree at a specific point once output? Log as attribute on the XML node, so later we can spot this and
			//open from that point
			if (jdo.openAtPath) { var currSel = this.xml.find(jdo.openAtPath); if (currSel.length == 1) currSel.attr('currSel', 'true'); }

			//start delving. Since JS seems to add another, outer root element, our (real) root it is child
			this.xml.children().each(function() { thiss.delve($(this)); });

			//do post-build stuff after delving complete
			this.postBuild();
		}


		/* -------------------
		| MAIN FUNC for outputting. Called recursively for all levels of tree
		------------------- */

		XMLTree.prototype.delve = function(node) {

			//what's this node's tag name?
			var tagName = node[0].tagName.replace(new RegExp('_'+rand+'$', 'i'), '').toLowerCase();

			//build LI and sub-UL for this node (note, tagname is applied as class to LI, for easy post-tree traversal)
			(this.delve_nextAppendTo ? this.delve_nextAppendTo : this.tree).append((li = $('<li>').addClass(tagName).append(LITxtHolder = $('<span>').addClass('LIText')).append(ul = $('<ul>'))));

			//plus/mins indicator
			li.append($('<span>', {html: jdo.startExpanded ? '-' : '+'}).addClass('plusMin collapsed'));

			//attributes...
			var attrs = node[0].attributes;

			//...add node attributes as classes? If true, all, else if array, only attributes specified in that array
			//For each eligible attribute, two classes are added: attr and attr-value
			if (jdo.attrsAsClasses) {
				for (var i=0; i<attrs.length; i++)
					if (jdo.attrsAsClasses === true || (typeof jdo.attrsAsClasses == 'string' && jdo.attrsAsClasses == attrs[i].name) || (jdo.attrsAsClasses instanceof Array && $.inArray(attrs[i].name, jdo.attrsAsClasses) != -1))
						li.addClass(attrs[i].name+'-'+attrs[i].value+' '+attrs[i].name);
			}

			//...add node attributes as element data? " " " " " " "
			if (jdo.attrsAsData) {
				for (var i=0; i<attrs.length; i++)
					if (jdo.attrsAsData === true || (typeof jdo.attrsAsData == 'string' && jdo.attrsAsData == attrs[i].name) || (jdo.attrsAsData instanceof Array && $.inArray(attrs[i].name, jdo.attrsAsData) != -1))
						li.data(attrs[i].name, attrs[i].value);
			}

			//...output attributes as LIs? (yes, no, or yes but hidden)
			if (!jdo.attrs || jdo.attrs != 'ignore') {
				if (attrs) {
					for(var i=0; i<attrs.length; i++) {
						if (attrs[i].value) {
							ul.append(attrLI = $('<li>').append($('<span>', {text: attrs[i].value}).addClass('attrValue')).addClass('attr '+attrs[i].name).prepend($('<span>', {text: '@'+attrs[i].name+':'})));
							if (jdo.attrs && jdo.attrs == 'hidden') attrLI.hide();
						}
					}
				}
			} else
				var attrs = false;

			//node has children? (for current purposes, attributes are considered children). If contains only attributes, and jdo.attrs
			//== 'hidden', count as having no kids
			var kids = node.children();
			if (!kids.length && (!attrs.length || (attrs.length && jdo.attrs && jdo.attrs == 'hidden'))) li.addClass('noKids');

			//span to show node name
			var tagName = $('<span>', {text: tagName}).addClass('tree_node');

			//if no children, simply append text (if any), otherwise iteratively call self on children
			if (!kids.length) {
				LITxtHolder.prepend(node.text()).prepend(tagName);
			} else {
				this.delve_nextAppendTo = ul;
				LITxtHolder.prepend(node.immediateText()+(!jdo.noDots ? '..' : '')).prepend(tagName);
				kids.each(function() { thiss.delve($(this)); });
				this.delve_nextAppendTo = this.delve_nextAppendTo.parent().parent();
			}

		}


		/* -------------------
		| POST BUILD stuff, e.g. click events, any user-defined HTML rules, update hash log in URL etc
		------------------- */

		XMLTree.prototype.postBuild = function() {

			//if doing sub-tree requests, ensure relevent branches always have plus-min icons visible
			if (jdo.subTreeBranches) {
				if (jdo.subTreeBranches === true)
					this.tree.addClass('subTreeRequestsOnAllNodes');
				else
					this.tree.find(jdo.subTreeBranches).addClass('subTreeNode');
			}

			//listen for clicks to expand/collapse nodes.

			this.tree.delegate('.plusMin', 'click', function(evt) {

				//prep
				evt.stopPropagation();
				var uls = $(this).parent().children('ul');
				var	currState = uls.filter(':hidden').length || !uls.length ? 'closed' : 'open',
					xPathToNode = returnXPathToNode($(this).parent()),
					li = $(this).parent();
				if (currState == 'closed') uls.show(); else uls.hide();

				//Plus/min click callback? Pass LI, LI's XPath, event obj. and string 'open' or 'close'
				if (jdo.plusMinCallback)
					jdo.plusMinCallback(li, xPathToNode, evt, currState);

				//Sub-tree request on expand? This should be a callback that returns a request URI that will load a sub-tree into
				//the current branch. Callback receives same args as plusMinCallback above. If data previously fetched (denoted
				//by data element on node), ignore.

				if (jdo.subTreeBranches && (jdo.subTreeBranches === true || $(this).parent().is('.subTreeNode')) && jdo.subTreeRequest && currState == 'closed' && !li.data('subTreeDataFetched')) {
					var subTreeReqURI = jdo.subTreeRequest(li, xPathToNode, evt, currState);
					if (subTreeReqURI && typeof subTreeReqURI == 'string') {
						var tree = new XMLTree($.extend(jdo, {fpath: subTreeReqURI, container: li}), true);
						if (tree) {
							li.data('subTreeDataFetched', true);
							tree.show();
						}
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
					location.replace('#tree'+thiss.instanceID+':'+paths.join('|')+';');
				}

			})

			//do callback on click to actual nodes? Pass LI, LI's xPath and event obj.
			if (jdo.clickCallback)
				this.tree.delegate('.LIText', 'click', function(evt) {
					var li = $(this).closest('li'); jdo.clickCallback(li, returnXPathToNode(li), evt);
				});

			//hide attrs if params say so
			if (jdo.hideAttrs && !jdo.subTree) this.tree.addClass('hideAttrs');

			//hide node names, if params say so
			if (jdo.hideNodeNames && !jdo.subTree) this.tree.addClass('hideNodeNames');

			//HTML rules?
			if (jdo.renderCallback) jdo.renderCallback(this.tree, this);


			//onload - re-entry point(s) stipulated in URL hash or in params (@openAtPath)?

			//...stipulated in hash
			var paths = new RegExp('#tree'+this.instanceID+':([0-9,\-\|]+);').exec(location.hash);
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

	//log instances
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
			var nodeName = $(this).children('.LIText').children('.node').text();
			var step = nodeName;
			var index = $(this).prevAll().filter(function() { return $(this).children('.LIText').children('.node').text() == nodeName; }).length + 1;
			if (index > 1) step += '['+index+']'
			path.push(step);
		 });
		return path.join('/');
	}

})(jQuery)