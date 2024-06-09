
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\components\Cover.svelte generated by Svelte v3.44.3 */

    const file$7 = "src\\components\\Cover.svelte";

    function create_fragment$7(ctx) {
    	let div1;
    	let div0;
    	let a0;
    	let t1;
    	let a1;
    	let t3;
    	let h1;
    	let t4;
    	let t5;
    	let p;
    	let t6;
    	let t7;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "వంచది";
    			t1 = space();
    			a1 = element("a");
    			a1.textContent = "తెల్లడి";
    			t3 = space();
    			h1 = element("h1");
    			t4 = text(/*title*/ ctx[0]);
    			t5 = space();
    			p = element("p");
    			t6 = text(/*description*/ ctx[1]);
    			t7 = space();
    			if (default_slot) default_slot.c();
    			attr_dev(a0, "href", "#/");
    			attr_dev(a0, "class", "text");
    			add_location(a0, file$7, 6, 8, 114);
    			attr_dev(a1, "href", "#/telladi");
    			attr_dev(a1, "class", "text");
    			add_location(a1, file$7, 7, 8, 159);
    			attr_dev(div0, "class", "header");
    			add_location(div0, file$7, 5, 4, 84);
    			attr_dev(h1, "class", "text");
    			add_location(h1, file$7, 10, 4, 223);
    			attr_dev(p, "class", "text");
    			add_location(p, file$7, 11, 4, 258);
    			attr_dev(div1, "class", "cover");
    			add_location(div1, file$7, 4, 0, 59);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, a0);
    			append_dev(div0, t1);
    			append_dev(div0, a1);
    			append_dev(div1, t3);
    			append_dev(div1, h1);
    			append_dev(h1, t4);
    			append_dev(div1, t5);
    			append_dev(div1, p);
    			append_dev(p, t6);
    			append_dev(div1, t7);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*title*/ 1) set_data_dev(t4, /*title*/ ctx[0]);
    			if (!current || dirty & /*description*/ 2) set_data_dev(t6, /*description*/ ctx[1]);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cover', slots, ['default']);
    	let { title, description } = $$props;
    	const writable_props = ['title', 'description'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Cover> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('description' in $$props) $$invalidate(1, description = $$props.description);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ title, description });

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('description' in $$props) $$invalidate(1, description = $$props.description);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, description, $$scope, slots];
    }

    class Cover extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { title: 0, description: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cover",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !('title' in props)) {
    			console.warn("<Cover> was created without expected prop 'title'");
    		}

    		if (/*description*/ ctx[1] === undefined && !('description' in props)) {
    			console.warn("<Cover> was created without expected prop 'description'");
    		}
    	}

    	get title() {
    		throw new Error("<Cover>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Cover>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<Cover>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<Cover>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    class Transliterator {

        transliterate = x => x;
        firstLoad = true;

        async fetch (script) {
            this.script = script;
            localStorage.setItem('script', script);
            if (this[script] || script == 'telugu') return;
            this[script] = await (await fetch(`/transliterations/${script}.json`)).json();
            this.transliterate = this[`${script}Transliterate`];
        }

        async loadScript () {
            let script = localStorage.getItem('script');
            if (script) {
                let selectElem = document.getElementById('trli');
                if (selectElem) selectElem.value = script;
                return await this.fetch(script);
            }
        }

        englishTransliterate (text) {
            let letters = this[this.script],
                arr = text.split('');

            text = '';

            for (let i = 0; i < arr.length; i++) {
                let x = arr[i];
        
                if (letters.consonants[x]) text += letters.consonants[x];
                else if (letters.vowels[x]) text += letters.vowels[x];
                else if (letters.diactrics[x]) text = text.slice(0, -1) + letters.diactrics[x];
                else if (letters.conjuncts[x]) text = text.slice(0, -1) + letters.conjuncts[x];
                else if (x == "్") text = text.slice(0, -1);
                else text += x;
            }
        
            return text;
        }

    }

    function approximateEnglishToTeluguSentence (txt) {
        let approx = { remainder: txt },
            suggestions = [''],
            initial = true;

        while (approx.remainder || initial) {
            let newSuggestions = [];
            approx = approximateEnglishToTelugu(approx.remainder);

            for (let i = 0; i < suggestions.length; i++) {
                let s = suggestions[i];
                for (let j = 0; j < approx.suggestions.length; j++)
                    newSuggestions.push(s + approx.suggestions[j]);
            }

            suggestions = newSuggestions;
            initial = false;
        }

        return [txt, ...suggestions];
    }

    function approximateEnglishToTelugu (extChar) {
        const mapSuggestions = (arr) => {
            let newSuggestions = [];

            suggestions.forEach(x => {
                arr.forEach(y => {
                    newSuggestions.push(x + y);
                });
            });

            return newSuggestions;
        };

        let suggestions = [],
            remainder = '',
            alien = false;

        if (!extChar) return { suggestions, remainder };
        let { primary, subExtChar } = slicePrimaryExtChar(extChar);

        if (TS.consonants[primary]) {
            suggestions.push(...TS.consonants[primary]);

            if (subExtChar) {
                let sliced = slicePrimaryExtChar(subExtChar);

                if (TS.diactrics[sliced.primary]) {
                    suggestions = mapSuggestions(TS.diactrics[sliced.primary]);
                    remainder = sliced.subExtChar;
                } else {
                    let secSubExtChar = subExtChar,
                        noDiactric = true;

                    while (true) {
                        sliced = slicePrimaryExtChar(secSubExtChar);
                        secSubExtChar = sliced.subExtChar;

                        if (!sliced.primary) break;
                        if (TS.conjuncts[sliced.primary]) {
                            suggestions = mapSuggestions(TS.conjuncts[sliced.primary]);
                            
                            let slicedVowel = slicePrimaryExtChar(secSubExtChar);
                            if (TS.diactrics[slicedVowel.primary]) {
                                suggestions = mapSuggestions(TS.diactrics[slicedVowel.primary]);
                                noDiactric = false;
                                remainder = slicedVowel.subExtChar;
                                break;
                            }
                        } else break;
                    }

                    if (noDiactric) suggestions = suggestions.map(x => x += "్");
                }
            } 
        } else if (TS.vowels[primary]) {
            suggestions.push(...TS.vowels[primary]);
            remainder = subExtChar;
        } else alien = true;

        return { suggestions, remainder, alien };
    }

    function changeTransliteration (docElem = document, record) {
        let tElements = docElem.getElementsByClassName('text'),
            iElements = docElem.getElementsByClassName('telugu-input');

        if (record) {
            iterate(tElements, x => x.originalContent = x.innerHTML);
            iterate(iElements, x => x.originalContent = x.placeholder);
        }

        if (!record && (T.script == 'telugu')) {
            iterate(tElements, x => x.innerHTML = x.originalContent);
            iterate(iElements, x => x.placeholder = x.originalContent);
        } else if (T.script && (T.script != 'telugu')) {
            iterate(tElements, x => x.innerHTML = T.transliterate(x.innerHTML));
            iterate(iElements, x => x.placeholder = T.transliterate(x.placeholder));
        } 
    }

    function slicePrimaryExtChar (txt) {
        if (txt[1] == 'h') 
            return { primary: txt[0] + 'h', subExtChar: txt.slice(2, txt.length) };
        else if (DOUBLE_SIZED_VOWELS.includes(txt.slice(0, 2))) 
            return { primary: txt.slice(0, 2), subExtChar: txt.slice(2, txt.length) };
        else 
            return { primary: txt[0], subExtChar: txt.slice(1, txt.length) };
    }

    function iterate (arr, func) {
        for (let i = 0; i < arr.length; i++) func(arr[i]);
    }

    // TeluguScript (TS) for transliterated typing in Telugu Input
    const TS = {
        "consonants": {
            "k": ["క"],
            "c": ["చ", "ౘ"],
            "t": ["త", "ట"],
            "p": ["ప"],
            "y": ["య"],
            "ś": ["శ"],
            "sh": ["శ", "ష"],
            "ṭ": ["ట"],
            "kh": ["ఖ"],
            "ch": ["చ", "ఛ", "ౘ"],
            "ṭh": ["ఠ"],
            "th": ["థ", "ఠ"],
            "ph": ["ఫ"],
            "r": ["ర", "ఱ"],
            "ṣ": ["ష"],
            "g": ["గ"],
            "j": ["జ"],
            "m": ["మ"],
            "ḍ": ["డ"],
            "d": ["ద", "డ", "ౚ"],
            "b": ["బ"],
            "l": ["ల", "ళ", "ఴ"],
            "s": ["స"],
            "gh": ["ఘ"],
            "jh": ["ఝ"],
            "ḍh": ["ఢ"],
            "dh": ["ధ", "ఢ"],
            "bh": ["భ"],
            "v": ["వ"],
            "ṟ": ["ఱ"],
            "ṅ": ["ఙ"],
            "n": ["న", "ఙ", "ఞ", "ం"],
            "ñ": ["ఞ"],
            "ḻ": ["ఴ"],
            "ḷ": ["ళ"],
            "zh": ["ఴ"],
            "h": ["హ"],
            "ĉ": ["ౘ"],
            "ẑ": ["ౙ"],
            "z": ["ౙ"],
            "ḏ": ["ౚ"]
        },
        "vowels": {
            "a": ["అ", "ఆ"],
            "ā": ["ఆ"],
            "aa": ["ఆ"],
            "i": ["ఇ", "ఈ"],
            "ī": ["ఈ"],
            "ee": ["ఈ"],
            "u": ["ఉ", "ఊ"],
            "ū": ["ఊ"],
            "oo": ["ఊ"],
            "e": ["ఎ", "ఏ"],
            "ē": ["ఏ"],
            "ae": ["ఏ"],
            "ai": ["ఐ"],
            "o": ["ఒ", "ఓ"],
            "ō": ["ఓ"],
            "au": ["ఔ"],
            "ṁ": ["ం"],
            "n̆": ["ఁ"]
        },
        "diactrics": {
            "a": ["", "ా"],
            "ā": ["ా"],
            "aa": ["ా"],
            "i": ["ి", "ీ"], 
            "ī": ["ీ"],
            "ee": ["ీ"],
            "u": ["ు", "ూ"],
            "ū": ["ూ"],
            "oo": ["ూ"],
            "e": ["ె", "ే"],
            "ē": ["ే"],
            "ae": ["ే"],
            "ai": ["ై"],
            "o": ["ొ", "ో"],
            "ō": ["ో"],
            "au": ["ౌ"],
            "ou": ["ౌ"]
        },
        "conjuncts": {
            "k": ["్క"],
            "c": ["్చ"],
            "t": ["్త", "్ట"],
            "p": ["్ప"],
            "y": ["్య"],
            "ś": ["్శ"],
            "sh": ["్శ", "్ష"],
            "ṭ": ["్ట"],
            "kh": ["్ఖ"],
            "ch": ["్చ", "్ఛ"],
            "ṭh": ["్ఠ"],
            "th": ["్థ", "్ఠ"],
            "ph": ["్ఫ"],
            "r": ["్ర", "్ఱ"],
            "ṣ": ["్ష"],
            "g": ["్గ"],
            "j": ["్జ"],
            "ma": ["్"],
            "ḍ": ["్డ"],
            "d": ["్ద", "్డ"],
            "b": ["్బ"],
            "l": ["్ల", "్ళ", "్ఴ"],
            "s": ["్స"],
            "gh": ["్ఘ"],
            "jh": ["్ఝ"],
            "ḍh": ["్ఢ"],
            "dh": ["్ధ", "్ఢ"],
            "bh": ["్భ"],
            "v": ["్వ"],
            "ṟ": ["్ఱ"],
            "ṅ": ["్ఙ"],
            "n": ["్న", "్ఙ", "్ఞ"],
            "ñ": ["్ఞ"],
            "ḻ": ["్ఴ"],
            "ḷ": ["్ళ"],
            "zh": ["్ఴ"]
        }
    };

    const DOUBLE_SIZED_VOWELS = ['aa', 'ae', 'oo', 'ee', 'ai', 'au'];

    const T = new Transliterator();

    const SCRIPTS = {
        english: "Roman Diactrics",
        telugu: "తెలుగు"
    };

    /* src\components\TLSelect.svelte generated by Svelte v3.44.3 */
    const file$6 = "src\\components\\TLSelect.svelte";

    function create_fragment$6(ctx) {
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = `${SCRIPTS[T.script ? T.script : "telugu"]}`;
    			option1 = element("option");
    			option1.textContent = "తెలుగు";
    			option2 = element("option");
    			option2.textContent = "Roman Diactrics";
    			option0.__value = "";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "hidden");
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$6, 9, 4, 294);
    			option1.__value = "telugu";
    			option1.value = option1.__value;
    			add_location(option1, file$6, 10, 4, 400);
    			option2.__value = "english";
    			option2.value = option2.__value;
    			add_location(option2, file$6, 11, 4, 444);
    			attr_dev(select, "name", "Transliteraton");
    			attr_dev(select, "id", "trli");
    			add_location(select, file$6, 4, 0, 107);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, select, anchor);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*change_handler*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(select);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TLSelect', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TLSelect> was created with unknown prop '${key}'`);
    	});

    	const change_handler = x => T.fetch(x.target.selectedOptions[0].value).then(() => changeTransliteration()).catch(() => {
    		
    	});

    	$$self.$capture_state = () => ({ T, SCRIPTS, changeTransliteration });
    	return [change_handler];
    }

    class TLSelect extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TLSelect",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\pages\Home.svelte generated by Svelte v3.44.3 */
    const file$5 = "src\\pages\\Home.svelte";

    // (15:4) <Cover           title="తెలుగు కూటము"           description="తెలుగు కూటానికి రావడము నెనరులు। ఈ కూటము ఏర్పడినది తెలుగు గుఱించి అందరికి చూపించడానికి। ఈ కూటములో మీరు తెలుగు గుఱించి చాలా చదువవచ్చు। ఇప్పుడు మీరు తెల్లడి చూవచ్చు మఱి వచ్చే నెలలలో ఇంకా చాలా గుఱించి చదువవచ్చు॥ వచ్చే నెలలలో తెలుగు పాతుడుము పేరులను తెలుగు ఏర్పాటెఱిమి గుఱించి చదువవచ్చు మీరు। ఉడుములు పాతపాత ఎడాతిలో ఉండినవి అనేది పాతుడుము। ఆంగ్లనుడిలో దీనిని దైనొసార్ అని అంటారు మంది। మఱి అన్ని మనీకులు ఎలా ఏర్పుతాము అనేది ఏర్పాటెఱిమి। ఆంగ్లనుడిలో దీనిని తాక్సొనొమీ అంటారు మంది॥"      >
    function create_default_slot$1(ctx) {
    	let tlselect;
    	let current;
    	tlselect = new TLSelect({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(tlselect.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tlselect, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tlselect.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tlselect.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tlselect, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(15:4) <Cover           title=\\\"తెలుగు కూటము\\\"           description=\\\"తెలుగు కూటానికి రావడము నెనరులు। ఈ కూటము ఏర్పడినది తెలుగు గుఱించి అందరికి చూపించడానికి। ఈ కూటములో మీరు తెలుగు గుఱించి చాలా చదువవచ్చు। ఇప్పుడు మీరు తెల్లడి చూవచ్చు మఱి వచ్చే నెలలలో ఇంకా చాలా గుఱించి చదువవచ్చు॥ వచ్చే నెలలలో తెలుగు పాతుడుము పేరులను తెలుగు ఏర్పాటెఱిమి గుఱించి చదువవచ్చు మీరు। ఉడుములు పాతపాత ఎడాతిలో ఉండినవి అనేది పాతుడుము। ఆంగ్లనుడిలో దీనిని దైనొసార్ అని అంటారు మంది। మఱి అన్ని మనీకులు ఎలా ఏర్పుతాము అనేది ఏర్పాటెఱిమి। ఆంగ్లనుడిలో దీనిని తాక్సొనొమీ అంటారు మంది॥\\\"      >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div;
    	let cover;
    	let current;

    	cover = new Cover({
    			props: {
    				title: "తెలుగు కూటము",
    				description: "తెలుగు కూటానికి రావడము నెనరులు। ఈ కూటము ఏర్పడినది తెలుగు గుఱించి అందరికి చూపించడానికి। ఈ కూటములో మీరు తెలుగు గుఱించి చాలా చదువవచ్చు। ఇప్పుడు మీరు తెల్లడి చూవచ్చు మఱి వచ్చే నెలలలో ఇంకా చాలా గుఱించి చదువవచ్చు॥ వచ్చే నెలలలో తెలుగు పాతుడుము పేరులను తెలుగు ఏర్పాటెఱిమి గుఱించి చదువవచ్చు మీరు। ఉడుములు పాతపాత ఎడాతిలో ఉండినవి అనేది పాతుడుము। ఆంగ్లనుడిలో దీనిని దైనొసార్ అని అంటారు మంది। మఱి అన్ని మనీకులు ఎలా ఏర్పుతాము అనేది ఏర్పాటెఱిమి। ఆంగ్లనుడిలో దీనిని తాక్సొనొమీ అంటారు మంది॥",
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(cover.$$.fragment);
    			add_location(div, file$5, 13, 0, 368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(cover, div, null);
    			/*div_binding*/ ctx[1](div);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const cover_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				cover_changes.$$scope = { dirty, ctx };
    			}

    			cover.$set(cover_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cover.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cover.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(cover);
    			/*div_binding*/ ctx[1](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	let homeElem;

    	onMount(() => {
    		if (!T.firstLoad) changeTransliteration(homeElem, true);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			homeElem = $$value;
    			$$invalidate(0, homeElem);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		Cover,
    		TLSelect,
    		T,
    		changeTransliteration,
    		homeElem
    	});

    	$$self.$inject_state = $$props => {
    		if ('homeElem' in $$props) $$invalidate(0, homeElem = $$props.homeElem);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [homeElem, div_binding];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\TeluguInput.svelte generated by Svelte v3.44.3 */
    const file$4 = "src\\components\\TeluguInput.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	child_ctx[16] = i;
    	return child_ctx;
    }

    // (70:4) {#each suggestions as s, i}
    function create_each_block$2(ctx) {
    	let p;
    	let t_value = /*s*/ ctx[14] + "";
    	let t;
    	let p_class_value;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[13](/*s*/ ctx[14]);
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);

    			attr_dev(p, "class", p_class_value = /*activeIndex*/ ctx[5] == /*i*/ ctx[16] + 1
    			? "active"
    			: "");

    			add_location(p, file$4, 70, 8, 2229);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);

    			if (!mounted) {
    				dispose = listen_dev(p, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*suggestions*/ 16 && t_value !== (t_value = /*s*/ ctx[14] + "")) set_data_dev(t, t_value);

    			if (dirty & /*activeIndex*/ 32 && p_class_value !== (p_class_value = /*activeIndex*/ ctx[5] == /*i*/ ctx[16] + 1
    			? "active"
    			: "")) {
    				attr_dev(p, "class", p_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(70:4) {#each suggestions as s, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let input;
    	let t0;
    	let div;
    	let p;
    	let b0;
    	let t1;
    	let b1;
    	let t3;
    	let div_class_value;
    	let div_style_value;
    	let mounted;
    	let dispose;
    	let each_value = /*suggestions*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			t0 = space();
    			div = element("div");
    			p = element("p");
    			b0 = element("b");
    			t1 = space();
    			b1 = element("b");
    			b1.textContent = "|";
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "telugu-input");
    			attr_dev(input, "placeholder", "వెతకడానికి వెతుకు నొక్కండి");
    			attr_dev(input, "autocomplete", "off");
    			attr_dev(input, "id", /*id*/ ctx[0]);
    			add_location(input, file$4, 49, 0, 1607);
    			set_style(b0, "margin-right", "-4px");
    			add_location(b0, file$4, 65, 8, 2076);
    			set_style(b1, "color", "lightblue");
    			add_location(b1, file$4, 66, 8, 2140);
    			attr_dev(p, "class", "tl");
    			add_location(p, file$4, 64, 4, 2052);
    			attr_dev(div, "class", div_class_value = "suggestions " + (/*openTl*/ ctx[3] ? "" : "hidden"));

    			attr_dev(div, "style", div_style_value = /*suggestions*/ ctx[4].length > 5
    			? "overflow-y: scroll;"
    			: "");

    			add_location(div, file$4, 60, 0, 1923);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			/*input_binding*/ ctx[9](input);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, b0);
    			/*b0_binding*/ ctx[12](b0);
    			append_dev(p, t1);
    			append_dev(p, b1);
    			append_dev(div, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keypress", /*keypress_handler*/ ctx[10], false, false, false),
    					listen_dev(input, "keydown", /*keydown_handler*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*id*/ 1) {
    				attr_dev(input, "id", /*id*/ ctx[0]);
    			}

    			if (dirty & /*activeIndex, selectTl, suggestions*/ 176) {
    				each_value = /*suggestions*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*openTl*/ 8 && div_class_value !== (div_class_value = "suggestions " + (/*openTl*/ ctx[3] ? "" : "hidden"))) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (dirty & /*suggestions*/ 16 && div_style_value !== (div_style_value = /*suggestions*/ ctx[4].length > 5
    			? "overflow-y: scroll;"
    			: "")) {
    				attr_dev(div, "style", div_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[9](null);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			/*b0_binding*/ ctx[12](null);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TeluguInput', slots, []);

    	let { onSubmit = () => {
    		
    	}, id } = $$props;

    	let inputElem, tlElem, openTl, suggestions = [];
    	let activeIndex = 0;

    	function updateTl(e) {
    		let content = tlElem.innerHTML;

    		if (e.key.length == 1) content += e.key; else if (e.key == 'Backspace') content = content.slice(0, content.length - 1); else if (e.key == 'Enter') {
    			if (openTl) {
    				selectTl(activeIndex ? suggestions[activeIndex - 1] : content);
    				return;
    			} else onSubmit(inputElem.value);
    		} else if (e.key == 'ArrowDown') {
    			$$invalidate(5, activeIndex = activeIndex + 1);
    			if (suggestions.length < activeIndex) $$invalidate(5, activeIndex = 0);
    		} else if (e.key == 'ArrowUp') {
    			$$invalidate(5, activeIndex = activeIndex - 1);
    			if (activeIndex < 0) $$invalidate(5, activeIndex = suggestions.length);
    		}

    		if (!content) {
    			$$invalidate(3, openTl = false);
    			$$invalidate(2, tlElem.innerHTML = '', tlElem);
    		} else $$invalidate(3, openTl = true);

    		$$invalidate(4, suggestions = approximateEnglishToTeluguSentence(content));
    		$$invalidate(2, tlElem.innerHTML = content, tlElem);
    		e.preventDefault();
    		return false;
    	}

    	function selectTl(s) {
    		let index = inputElem.selectionStart, content = inputElem.value;
    		content = content.slice(0, index) + s + content.slice(index, content.length);
    		$$invalidate(1, inputElem.value = content, inputElem);
    		inputElem.focus();
    		$$invalidate(2, tlElem.innerHTML = '', tlElem);
    		$$invalidate(3, openTl = false);
    	}

    	const writable_props = ['onSubmit', 'id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TeluguInput> was created with unknown prop '${key}'`);
    	});

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			inputElem = $$value;
    			$$invalidate(1, inputElem);
    		});
    	}

    	const keypress_handler = e => !openTl || e.key == 'Enter' ? updateTl(e) : null;
    	const keydown_handler = e => openTl && e.key != 'Enter' ? updateTl(e) : null;

    	function b0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			tlElem = $$value;
    			$$invalidate(2, tlElem);
    		});
    	}

    	const click_handler = s => selectTl(s);

    	$$self.$$set = $$props => {
    		if ('onSubmit' in $$props) $$invalidate(8, onSubmit = $$props.onSubmit);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		approximateEnglishToTeluguSentence,
    		onSubmit,
    		id,
    		inputElem,
    		tlElem,
    		openTl,
    		suggestions,
    		activeIndex,
    		updateTl,
    		selectTl
    	});

    	$$self.$inject_state = $$props => {
    		if ('onSubmit' in $$props) $$invalidate(8, onSubmit = $$props.onSubmit);
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('inputElem' in $$props) $$invalidate(1, inputElem = $$props.inputElem);
    		if ('tlElem' in $$props) $$invalidate(2, tlElem = $$props.tlElem);
    		if ('openTl' in $$props) $$invalidate(3, openTl = $$props.openTl);
    		if ('suggestions' in $$props) $$invalidate(4, suggestions = $$props.suggestions);
    		if ('activeIndex' in $$props) $$invalidate(5, activeIndex = $$props.activeIndex);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		id,
    		inputElem,
    		tlElem,
    		openTl,
    		suggestions,
    		activeIndex,
    		updateTl,
    		selectTl,
    		onSubmit,
    		input_binding,
    		keypress_handler,
    		keydown_handler,
    		b0_binding,
    		click_handler
    	];
    }

    class TeluguInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { onSubmit: 8, id: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TeluguInput",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[0] === undefined && !('id' in props)) {
    			console.warn("<TeluguInput> was created without expected prop 'id'");
    		}
    	}

    	get onSubmit() {
    		throw new Error("<TeluguInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onSubmit(value) {
    		throw new Error("<TeluguInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<TeluguInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<TeluguInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    async function getDailyWords () {
        return await (await fetch('https://raw.githubusercontent.com/telugukootam/telugukootam.github.io/main/dailyWords.json')).json()
    }

    function search (query) {
        return fetchAPI(`/search/${query}`);
    }

    function filterAlts (alts) {
        let eng = [], skt = [];

        for (let i = 0; i < alts.length; i++) {
            let a = alts[i];
            if (isEnglish(a)) eng.push(a);
            else skt.push(a);
        }

        return { eng, skt };
    }

    function formatSourceText (txt) {
        let formatted = [], lastIndex = 0;

        txt.matchAll(BADGE_FORMAT_REGEX).forEach(x => {
            formatted.push({ normal: txt.slice(lastIndex, x.index) }, { badge: x[1] });
            lastIndex = x.index + x[0].length;
        });

        return formatted.length ? formatted : [{ normal: txt }];
    }

    async function fetchAPI (path) {
        return await (await fetch(DB_URL + path)).json();
    }

    function isEnglish (x) {
        return x.toUpperCase() != x.toLowerCase();
    }

    const DB_URL = 'http://localhost:8000';
    const BADGE_FORMAT_REGEX = /\{(.*?)\}/g;

    // const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g

    /* src\components\Word.svelte generated by Svelte v3.44.3 */
    const file$3 = "src\\components\\Word.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    // (19:4) {#if skt.length}
    function create_if_block_4(ctx) {
    	let p;
    	let b;
    	let t1;
    	let ol;
    	let each_value_3 = /*skt*/ ctx[2];
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			b = element("b");
    			b.textContent = "సంస్కృత సరియైనవి:";
    			t1 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(b, file$3, 19, 24, 496);
    			attr_dev(p, "class", "text");
    			add_location(p, file$3, 19, 8, 480);
    			add_location(ol, file$3, 21, 8, 536);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, b);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*skt*/ 4) {
    				each_value_3 = /*skt*/ ctx[2];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ol, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ol);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(19:4) {#if skt.length}",
    		ctx
    	});

    	return block;
    }

    // (23:12) {#each skt as s}
    function create_each_block_3(ctx) {
    	let li;
    	let t_value = /*s*/ ctx[3] + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			attr_dev(li, "class", "text");
    			add_location(li, file$3, 23, 16, 588);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*skt*/ 4 && t_value !== (t_value = /*s*/ ctx[3] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(23:12) {#each skt as s}",
    		ctx
    	});

    	return block;
    }

    // (29:4) {#if eng.length}
    function create_if_block_3(ctx) {
    	let p;
    	let b;
    	let t1;
    	let ol;
    	let each_value_2 = /*eng*/ ctx[1];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			b = element("b");
    			b.textContent = "ఆంగ్ల సరియైనవి:";
    			t1 = space();
    			ol = element("ol");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(b, file$3, 29, 24, 710);
    			attr_dev(p, "class", "text");
    			add_location(p, file$3, 29, 8, 694);
    			add_location(ol, file$3, 31, 8, 748);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, b);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ol, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ol, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*eng*/ 2) {
    				each_value_2 = /*eng*/ ctx[1];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ol, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ol);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(29:4) {#if eng.length}",
    		ctx
    	});

    	return block;
    }

    // (33:12) {#each eng as e}
    function create_each_block_2(ctx) {
    	let li;
    	let t_value = /*e*/ ctx[9] + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			add_location(li, file$3, 33, 16, 800);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*eng*/ 2 && t_value !== (t_value = /*e*/ ctx[9] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(33:12) {#each eng as e}",
    		ctx
    	});

    	return block;
    }

    // (39:4) {#if info.n}
    function create_if_block_2(ctx) {
    	let p;
    	let b;
    	let t1;
    	let each_value_1 = /*info*/ ctx[0].n;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			b = element("b");
    			b.textContent = "ఏర్పాటు:";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(b, file$3, 40, 12, 919);
    			attr_dev(p, "class", "text");
    			add_location(p, file$3, 39, 8, 889);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, b);
    			append_dev(p, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(p, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*info*/ 1) {
    				each_value_1 = /*info*/ ctx[0].n;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(p, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(39:4) {#if info.n}",
    		ctx
    	});

    	return block;
    }

    // (42:12) {#each info.n as x, i}
    function create_each_block_1(ctx) {
    	let p;
    	let t0_value = /*x*/ ctx[6] + "";
    	let t0;

    	let t1_value = (/*i*/ ctx[8] == /*info*/ ctx[0].n.length - 1
    	? " "
    	: " + ") + "";

    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = text(t1_value);
    			attr_dev(p, "class", "badge");
    			add_location(p, file$3, 42, 16, 988);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*info*/ 1 && t0_value !== (t0_value = /*x*/ ctx[6] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*info*/ 1 && t1_value !== (t1_value = (/*i*/ ctx[8] == /*info*/ ctx[0].n.length - 1
    			? " "
    			: " + ") + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(42:12) {#each info.n as x, i}",
    		ctx
    	});

    	return block;
    }

    // (48:4) {#if info.s}
    function create_if_block$2(ctx) {
    	let p0;
    	let b;
    	let t1;
    	let p1;
    	let each_value = formatSourceText(/*info*/ ctx[0].s);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			b = element("b");
    			b.textContent = "పుట్టువు:";
    			t1 = space();
    			p1 = element("p");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(b, file$3, 48, 24, 1144);
    			attr_dev(p0, "class", "text");
    			add_location(p0, file$3, 48, 8, 1128);
    			attr_dev(p1, "class", "text src");
    			set_style(p1, "margin-left", "25px");
    			add_location(p1, file$3, 49, 8, 1174);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, b);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(p1, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*formatSourceText, info*/ 1) {
    				each_value = formatSourceText(/*info*/ ctx[0].s);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(p1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(48:4) {#if info.s}",
    		ctx
    	});

    	return block;
    }

    // (54:16) {:else}
    function create_else_block$2(ctx) {
    	let p;
    	let t_value = /*s*/ ctx[3].badge + "";
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			attr_dev(p, "class", "badge");
    			add_location(p, file$3, 54, 20, 1383);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*info*/ 1 && t_value !== (t_value = /*s*/ ctx[3].badge + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(54:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (52:16) {#if s.normal}
    function create_if_block_1$1(ctx) {
    	let t_value = /*s*/ ctx[3].normal + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*info*/ 1 && t_value !== (t_value = /*s*/ ctx[3].normal + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(52:16) {#if s.normal}",
    		ctx
    	});

    	return block;
    }

    // (51:12) {#each formatSourceText(info.s) as s}
    function create_each_block$1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*s*/ ctx[3].normal) return create_if_block_1$1;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(51:12) {#each formatSourceText(info.s) as s}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let h2;
    	let t0_value = /*info*/ ctx[0].w + "";
    	let t0;
    	let t1;
    	let p0;
    	let t2_value = (/*info*/ ctx[0].n ? "కొత్తది" : "ఉన్నది") + "";
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let p1;
    	let t8;
    	let t9_value = /*info*/ ctx[0].id + "";
    	let t9;
    	let if_block0 = /*skt*/ ctx[2].length && create_if_block_4(ctx);
    	let if_block1 = /*eng*/ ctx[1].length && create_if_block_3(ctx);
    	let if_block2 = /*info*/ ctx[0].n && create_if_block_2(ctx);
    	let if_block3 = /*info*/ ctx[0].s && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			t6 = space();
    			if (if_block3) if_block3.c();
    			t7 = space();
    			p1 = element("p");
    			t8 = text("ID: ");
    			t9 = text(t9_value);
    			attr_dev(h2, "class", "text");
    			set_style(h2, "margin-top", "-10px");
    			add_location(h2, file$3, 15, 4, 276);
    			attr_dev(p0, "class", "badge text");
    			set_style(p0, "position", "relative");
    			set_style(p0, "top", "-5px");
    			set_style(p0, "left", "4px");
    			add_location(p0, file$3, 16, 4, 339);
    			attr_dev(p1, "class", "id");
    			add_location(p1, file$3, 60, 4, 1490);
    			attr_dev(div, "class", "word");
    			add_location(div, file$3, 14, 0, 252);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, t2);
    			append_dev(div, t3);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t4);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t5);
    			if (if_block2) if_block2.m(div, null);
    			append_dev(div, t6);
    			if (if_block3) if_block3.m(div, null);
    			append_dev(div, t7);
    			append_dev(div, p1);
    			append_dev(p1, t8);
    			append_dev(p1, t9);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*info*/ 1 && t0_value !== (t0_value = /*info*/ ctx[0].w + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*info*/ 1 && t2_value !== (t2_value = (/*info*/ ctx[0].n ? "కొత్తది" : "ఉన్నది") + "")) set_data_dev(t2, t2_value);

    			if (/*skt*/ ctx[2].length) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*eng*/ ctx[1].length) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div, t5);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*info*/ ctx[0].n) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(div, t6);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*info*/ ctx[0].s) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block$2(ctx);
    					if_block3.c();
    					if_block3.m(div, t7);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty & /*info*/ 1 && t9_value !== (t9_value = /*info*/ ctx[0].id + "")) set_data_dev(t9, t9_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Word', slots, []);
    	let { info } = $$props;
    	let eng, skt;
    	const writable_props = ['info'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Word> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('info' in $$props) $$invalidate(0, info = $$props.info);
    	};

    	$$self.$capture_state = () => ({
    		filterAlts,
    		formatSourceText,
    		info,
    		eng,
    		skt
    	});

    	$$self.$inject_state = $$props => {
    		if ('info' in $$props) $$invalidate(0, info = $$props.info);
    		if ('eng' in $$props) $$invalidate(1, eng = $$props.eng);
    		if ('skt' in $$props) $$invalidate(2, skt = $$props.skt);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*info*/ 1) {
    			{
    				let alts = filterAlts(info.a);
    				$$invalidate(1, eng = alts.eng);
    				$$invalidate(2, skt = alts.skt);
    			}
    		}
    	};

    	return [info, eng, skt];
    }

    class Word extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { info: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Word",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*info*/ ctx[0] === undefined && !('info' in props)) {
    			console.warn("<Word> was created without expected prop 'info'");
    		}
    	}

    	get info() {
    		throw new Error("<Word>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set info(value) {
    		throw new Error("<Word>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Telladi.svelte generated by Svelte v3.44.3 */
    const file$2 = "src\\pages\\Telladi.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	return child_ctx;
    }

    // (38:4) <Cover           title="తెల్లడి"           description="ఈ తెల్లడిలో అన్ని ఉన్న కొత్త తెలుగు మాటలను చూడవచ్చు మీరు। ఒకొక తెలుగు మాటలకు ఆంగ్లమాటను సంస్కృతమాటను చూడవచ్చు మీరు అందరు దీనిని చదువుతూ చూపించిన తెలుగు మాటల తెల్లాలను తెలుసుకోవచ్చు। మఱి కొత్త తెలుగు మాటలకు వీటి తొలిమి చూడవచ్చు మీరు। తొలిమి అంటే మాట ఎలా ఏర్పడినది॥"      >
    function create_default_slot(ctx) {
    	let teluguinput;
    	let t0;
    	let tlselect;
    	let t1;
    	let a;
    	let current;
    	let mounted;
    	let dispose;

    	teluguinput = new TeluguInput({
    			props: { id: "search", onSubmit: /*func*/ ctx[6] },
    			$$inline: true
    		});

    	tlselect = new TLSelect({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(teluguinput.$$.fragment);
    			t0 = space();
    			create_component(tlselect.$$.fragment);
    			t1 = space();
    			a = element("a");
    			a.textContent = "వెతుకు";
    			attr_dev(a, "class", "text search-btn");
    			add_location(a, file$2, 45, 8, 1695);
    		},
    		m: function mount(target, anchor) {
    			mount_component(teluguinput, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(tlselect, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, a, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const teluguinput_changes = {};
    			if (dirty & /*searchQuery*/ 1) teluguinput_changes.onSubmit = /*func*/ ctx[6];
    			teluguinput.$set(teluguinput_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(teluguinput.$$.fragment, local);
    			transition_in(tlselect.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(teluguinput.$$.fragment, local);
    			transition_out(tlselect.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(teluguinput, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(tlselect, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(38:4) <Cover           title=\\\"తెల్లడి\\\"           description=\\\"ఈ తెల్లడిలో అన్ని ఉన్న కొత్త తెలుగు మాటలను చూడవచ్చు మీరు। ఒకొక తెలుగు మాటలకు ఆంగ్లమాటను సంస్కృతమాటను చూడవచ్చు మీరు అందరు దీనిని చదువుతూ చూపించిన తెలుగు మాటల తెల్లాలను తెలుసుకోవచ్చు। మఱి కొత్త తెలుగు మాటలకు వీటి తొలిమి చూడవచ్చు మీరు। తొలిమి అంటే మాట ఎలా ఏర్పడినది॥\\\"      >",
    		ctx
    	});

    	return block;
    }

    // (57:12) {:else}
    function create_else_block$1(ctx) {
    	let h3;

    	function select_block_type_1(ctx, dirty) {
    		if (/*error*/ ctx[3]) return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			if_block.c();
    			attr_dev(h3, "class", "text");
    			add_location(h3, file$2, 57, 16, 2144);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			if_block.m(h3, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type_1(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(h3, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(57:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (53:12) {#if words.length}
    function create_if_block$1(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*words*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*words*/ 4) {
    				each_value = /*words*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(53:12) {#if words.length}",
    		ctx
    	});

    	return block;
    }

    // (61:20) {:else}
    function create_else_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("మా డేటాబేస్‌లో ఈ మాట కోసమైన ఎలాంటి పంటకాలు కనుగొనలేకపోయాము.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(61:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (59:20) {#if error}
    function create_if_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("ఒక్క తప్పు జరిగింది. ఒక వేల ఈ తప్పు చాలా సేపు తర్వాత కూడా సరియవలేవంటే మమ్మల్ని కైతాన్కన్డి (సంప్రదించండి).");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(59:20) {#if error}",
    		ctx
    	});

    	return block;
    }

    // (54:16) {#each words as word}
    function create_each_block(ctx) {
    	let word;
    	let current;

    	word = new Word({
    			props: { info: /*word*/ ctx[10] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(word.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(word, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const word_changes = {};
    			if (dirty & /*words*/ 4) word_changes.info = /*word*/ ctx[10];
    			word.$set(word_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(word.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(word.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(word, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(54:16) {#each words as word}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div2;
    	let cover;
    	let t0;
    	let div1;
    	let h1;

    	let t1_value = (/*searchQuery*/ ctx[0]
    	? `"${/*searchQuery*/ ctx[0]}" కోసమైన వెతక పంటకాలు `
    	: "నేటి మాటలు") + "";

    	let t1;
    	let t2;
    	let hr;
    	let t3;
    	let div0;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	cover = new Cover({
    			props: {
    				title: "తెల్లడి",
    				description: "ఈ తెల్లడిలో అన్ని ఉన్న కొత్త తెలుగు మాటలను చూడవచ్చు మీరు। ఒకొక తెలుగు మాటలకు ఆంగ్లమాటను సంస్కృతమాటను చూడవచ్చు మీరు అందరు దీనిని చదువుతూ చూపించిన తెలుగు మాటల తెల్లాలను తెలుసుకోవచ్చు। మఱి కొత్త తెలుగు మాటలకు వీటి తొలిమి చూడవచ్చు మీరు। తొలిమి అంటే మాట ఎలా ఏర్పడినది॥",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*words*/ ctx[2].length) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(cover.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			hr = element("hr");
    			t3 = space();
    			div0 = element("div");
    			if_block.c();
    			attr_dev(h1, "class", "text");
    			add_location(h1, file$2, 49, 8, 1853);
    			add_location(hr, file$2, 49, 101, 1946);
    			add_location(div0, file$2, 51, 8, 1963);
    			attr_dev(div1, "class", "body");
    			add_location(div1, file$2, 48, 4, 1825);
    			add_location(div2, file$2, 36, 0, 1177);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(cover, div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, hr);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			/*div2_binding*/ ctx[8](div2);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const cover_changes = {};

    			if (dirty & /*$$scope, searchQuery*/ 8193) {
    				cover_changes.$$scope = { dirty, ctx };
    			}

    			cover.$set(cover_changes);

    			if ((!current || dirty & /*searchQuery*/ 1) && t1_value !== (t1_value = (/*searchQuery*/ ctx[0]
    			? `"${/*searchQuery*/ ctx[0]}" కోసమైన వెతక పంటకాలు `
    			: "నేటి మాటలు") + "")) set_data_dev(t1, t1_value);

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div0, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cover.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cover.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(cover);
    			if_blocks[current_block_type_index].d();
    			/*div2_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Telladi', slots, []);
    	let { query } = $$props;

    	const updateWords = (data, err) => {
    		$$invalidate(3, error = err);
    		return $$invalidate(2, words = data);
    	};

    	let searchQuery = query, telladiElem, words = [], error;
    	var dailyWords = []; // Non state variable

    	onMount(() => {
    		if (!T.firstLoad) changeTransliteration(telladiElem, true);
    	});

    	afterUpdate(() => changeTransliteration(telladiElem, true));
    	getDailyWords().then(x => $$invalidate(5, dailyWords = updateWords(x))).catch(() => updateWords([], true));
    	const writable_props = ['query'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Telladi> was created with unknown prop '${key}'`);
    	});

    	const func = x => $$invalidate(0, searchQuery = x);
    	const click_handler = () => $$invalidate(0, searchQuery = document.getElementById('search').value);

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			telladiElem = $$value;
    			$$invalidate(1, telladiElem);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('query' in $$props) $$invalidate(4, query = $$props.query);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		onMount,
    		Cover,
    		TeluguInput,
    		Word,
    		TLSelect,
    		T,
    		changeTransliteration,
    		getDailyWords,
    		search,
    		query,
    		updateWords,
    		searchQuery,
    		telladiElem,
    		words,
    		error,
    		dailyWords
    	});

    	$$self.$inject_state = $$props => {
    		if ('query' in $$props) $$invalidate(4, query = $$props.query);
    		if ('searchQuery' in $$props) $$invalidate(0, searchQuery = $$props.searchQuery);
    		if ('telladiElem' in $$props) $$invalidate(1, telladiElem = $$props.telladiElem);
    		if ('words' in $$props) $$invalidate(2, words = $$props.words);
    		if ('error' in $$props) $$invalidate(3, error = $$props.error);
    		if ('dailyWords' in $$props) $$invalidate(5, dailyWords = $$props.dailyWords);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*searchQuery, dailyWords*/ 33) {
    			if (searchQuery) search(searchQuery).then(x => updateWords(x)).catch(() => updateWords([], true)); else $$invalidate(2, words = dailyWords);
    		}
    	};

    	return [
    		searchQuery,
    		telladiElem,
    		words,
    		error,
    		query,
    		dailyWords,
    		func,
    		click_handler,
    		div2_binding
    	];
    }

    class Telladi extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { query: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Telladi",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*query*/ ctx[4] === undefined && !('query' in props)) {
    			console.warn("<Telladi> was created without expected prop 'query'");
    		}
    	}

    	get query() {
    		throw new Error("<Telladi>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set query(value) {
    		throw new Error("<Telladi>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.44.3 */

    const file$1 = "src\\components\\Footer.svelte";

    function create_fragment$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = `తెలుగుకుటము © ${new Date(Date.now()).getFullYear()}`;
    			attr_dev(div, "class", "footer text");
    			add_location(div, file$1, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    function router () {
        let request = {};

        if (window.location.search) {
            let queries = new URLSearchParams(window.location.search);

            request = {
                telladi: queries.get('telladi'),
                query: queries.get('query'),
                id: queries.get('id')
            };
        } else {
            let split = window.location.hash.slice(2).split('?'),
                queries = new URLSearchParams(split[1]);

            request = {
                telladi: split[0] == 'telladi',
                query: queries.get('query'),
                id: queries.get('id')
            };
        }

        return request;
    }

    /* src\App.svelte generated by Svelte v3.44.3 */
    const file = "src\\App.svelte";

    // (24:4) {:else}
    function create_else_block(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(24:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:4) {#if request.telladi}
    function create_if_block(ctx) {
    	let telladi;
    	let current;

    	telladi = new Telladi({
    			props: { query: /*request*/ ctx[0].query },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(telladi.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(telladi, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const telladi_changes = {};
    			if (dirty & /*request*/ 1) telladi_changes.query = /*request*/ ctx[0].query;
    			telladi.$set(telladi_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(telladi.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(telladi.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(telladi, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(22:4) {#if request.telladi}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let footer;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*request*/ ctx[0].telladi) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t = space();
    			create_component(footer.$$.fragment);
    			set_style(div, "min-height", "100em");
    			add_location(div, file, 20, 0, 610);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			insert_dev(target, t, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    			if (detaching) detach_dev(t);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let request = {};
    	window.addEventListener('hashchange', () => $$invalidate(0, request = router()));

    	onMount(async () => {
    		$$invalidate(0, request = router());
    		await T.loadScript();
    		changeTransliteration(document, true);
    		T.firstLoad = false;
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		Home,
    		Telladi,
    		Footer,
    		T,
    		changeTransliteration,
    		router,
    		request
    	});

    	$$self.$inject_state = $$props => {
    		if ('request' in $$props) $$invalidate(0, request = $$props.request);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [request];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var main = new App({ target: document.body });

    return main;

})();
