/**
 * @fileOverview Requirejs modifier for default XHR-based network operations
 * @author Chris Warren <chris.warren@bbc.co.uk>
 * @version 1.0.0
 */
require.def(
	'antie/devices/net/default',
	['antie/devices/browserdevice'],
	function(Device) {
		/**
		 * Loads an external script that calls a specified callback function.
		 * Used for loading data via JSON-P.
		 * @param {String} url The URL of the script.
		 * @param {RegExp} callbackFunctionRegExp Regular expression to replace matches with callback function name.
		 * @param {Object} callbacks Object containing onSuccess and onLoad callback functions.
		 * @param {Integer} timeout Timeout in milliseconds.
		 * @param {String} [callbackSuffix] Suffix to append to end of callback function name.
		 * @returns The script element that will load the script.
		 */
		Device.prototype.loadScript = function(url, callbackFunctionRegExp, callbacks, timeout, callbackSuffix) {
			var self = this;
			var script = null;
			var funcName = "_antie_callback_" + (callbackSuffix || ((new Date() * 1) + "_" + Math.floor(Math.random() * 10000000)));

			var timeoutHandle = window.setTimeout(function() {
				if (window[funcName]) {
					if (script) {
						self.removeElement(script);
					}
					delete window[funcName];
					if (callbacks && callbacks.onError) {
						callbacks.onError('timeout');
					}
				}
			}, timeout || 5000);

			window[funcName] = function(obj) {
				if (timeout) {
					window.clearTimeout(timeoutHandle);
				}
				if (callbacks && callbacks.onSuccess) {
					callbacks.onSuccess(obj);
				}
				self.removeElement(script);
				delete window[funcName];
			};

			script = this._createElement("script");
			script.src = url.replace(callbackFunctionRegExp, funcName);
			var head = document.getElementsByTagName("head")[0];
			head.appendChild(script);
			return script;
		},
		/**
		 * Loads a resource from a URL protected by device authentication.
		 * @param {String} url The URL to load.
		 * @param {Object} opts Object containing onLoad and onError callback functions.
		 * @returns The request object used to load the resource.
		 */
		Device.prototype.loadAuthenticatedURL = function(url, opts) {
			// Simple implementation - assuming XHR in browser can perform client-authenticated SSL requests
			return this.loadURL(url, opts);
		},
		/**
		 * Loads a resource from a URL.
		 * @param {String} url The URL to load.
		 * @param {Object} opts Object containing onLoad and onError callback functions.
		 * @returns The request object used to load the resource.
		 */
		Device.prototype.loadURL = function(url, opts) {
			var xhr = new XMLHttpRequest();
			xhr.open(opts.method || 'GET', url, true);
			xhr.onreadystatechange = function() {
				if (this.readyState == 4) {
					this.onreadystatechange = null;
					if (this.status == 200) {
						if (opts.onLoad) {
							opts.onLoad(this.responseText);
						}
					} else {
						if (opts.onError) {
							opts.onError(this.responseText, this.status);
						}
					}
				}
			};
			if (opts && opts.headers) {
				for (var header in opts.headers) {
					xhr.setRequestHeader(header, opts.headers[header]);
				}
			}

			try {
				xhr.send(opts.data || null);
			} catch(ex) {
				if (opts.onError) {
					opts.onError(ex);
				}
			}
			return xhr;
		},
		/**
		 * Performs a POST HTTP request to a URL on a different host/domain.
		 * @param {String} url The URL to post to.
		 * @param {Object} data Associative array of fields/values to post.
		 * @param {Object} opts Object containing onLoad and onError callback functions.
		 */
		Device.prototype.crossDomainPost = function(url, data, opts) {
			var iframe, form;
            var postRequestHasBeenSent = false;
            var blankPageToLoad = opts.blankUrl || "blank.html";

			function iframeLoadTimeoutCallback() {
				iframe.onload = null;
				if(opts.onError) opts.onError("timeout");
			}

			function iframeLoadedCallback() {
				var urlLoadedIntoInvisibleIFrame, errorGettingIFrameLocation;
				try {
					urlLoadedIntoInvisibleIFrame = iframe.contentWindow.location.href;
				} catch (exception) {
                    errorGettingIFrameLocation = exception;
				}

				if(errorGettingIFrameLocation || !urlLoadedIntoInvisibleIFrame) {
					// we didn't load the page - give the browser a second chance to load the iframe
                    setTimeout(function() { iframe.src = blankPageToLoad+"#2"; }, 500);
                    return;
				}

                if (postRequestHasBeenSent === false) {
                    postRequestHasBeenSent = true;

                    createForm();
                    for(var name in data) {
                        createField(name, data[name]);
                    }
                    form.submit();
                }
                else {
                    iframe.onload = null;
                    try {
                        var responseData = iframe.contentWindow.name;
                        iframe.parentNode.removeChild(iframe);
                        if (opts.onLoad) {
                            opts.onLoad(responseData);
                        }
                    } catch (exception) {
                        if(opts.onError) opts.onError(exception);
                    }
                }
            }

			function createForm() {
				var doc = iframe.contentWindow.document;
				form = doc.createElement('form');
				form.method = 'POST';
				form.action = url;
				doc.body.appendChild(form);
			}

			function createField(name, value) {
				var input = document.createElement('input');
				input.type = "hidden";
				input.name = name;
				input.value = value;
				form.appendChild(input);
			}

			function createIframe() {
				iframe = document.createElement('iframe');
				iframe.style.width = "0";
				iframe.style.height = "0";
				iframe.src = blankPageToLoad+"#1";
				iframe.onload = iframeLoadedCallback;
				document.body.appendChild(iframe);
			}

			setTimeout(iframeLoadTimeoutCallback, (opts.timeout || 10) * 1000); /* 10 second default */
			createIframe();
		};
	}
);

