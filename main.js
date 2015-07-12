(function() {

  var resource = '..';

  var setStatus = (function() {
    var statusBar;

    function countDown(str, now) {
      statusBar.textContent = str.replace(/\${time}/g, now);
      if(now - 1 > 0) {
        setTimeout(function() {
          countDown(str, now - 1);
        }, 1000);
      }
    }

    return function(s, t) {
      if(!statusBar) {
        statusBar = document.querySelector('#status p');
      }
      if(t) {
        countDown(s, t);
      } else {
        statusBar.textContent = s;
      }
    };
  })();

  var inputPrompt = (function() {
    var notice = document.createElement('div');
    notice.setAttribute('id', 'notice');
    var h1 = document.createElement('h1');
    notice.appendChild(h1);
    var input = document.createElement('input');
    notice.appendChild(input);

    return function(msg, type) {
      input.setAttribute('type', type || 'text');
      h1.textContent = msg;
      document.body.appendChild(notice);
      input.focus();
      return new Promise(function(resolve, reject) {
        input.onkeypress = function(event) {
          if(event.keyCode === 13) {
            var value = input.value;
            input.value = '';
            input.onkeypress = null;
            document.body.removeChild(notice);
            resolve(value);
          }
        };
      });
    };
  })();

  function getCredentials() {
    return inputPrompt('Enter your authorized username').then(function(username) {
      return inputPrompt('Enter your password', 'password').then(function(password) {
        return [username, password];
      });
    });
  }

  function getNodeList(credentials) {
    setStatus('Fetching node list');

    var username = credentials[0];
    var password = credentials[1];
    return new Promise(function(resolve, reject) {
      var formData = new FormData();
      formData.append('nl', '*');

      var xhr = new XMLHttpRequest();
      xhr.open('POST', resource + '/json', true, username, password);
      xhr.onload = function(e) {
        if(this.status === 200) {
          try {
            resolve(JSON.parse(this.responseText));
          } catch(e) {
            reject(e);
          }
        } else {
          reject(new Error(this.status + ': ' + this.statusText));
        }
      };
      xhr.onerror = function(e) {
        reject('Request error');
      };

      xhr.send('nl=*');
    });
  }

  function parseNodes(nodeList) {
    setStatus('Parsing node list');

    var devices = [];
    for(var node in nodeList.nodes) {
      for(var item in nodeList.nodes[node]) {
        if(/^DEV\d+$/.test(item)) {
          devices.push({
            id: node,
            device: item,
            deviceId: parseInt(/^DEV(\d+)$/.exec(item)[1], 10),
            name: nodeList.nodes[node][item],
            active: nodeList.nodes[node]['ZigBee'] === 0 || nodeList.nodes[node]['LOCAL'] === 0 || false,
            type: 'VAV box'
          });
          break;
        }
      }
    }
    devices.sort(function(a, b) {
      var idA = a.deviceId;
      var idB = b.deviceId;
      if(idA < idB) {
        return -1;
      } else if(idA > idB) {
        return 1;
      } else {
        return 0;
      }
    });
    return {
      local: nodeList.local,
      devices: devices
    };
  };

  var registerDevices = (function() {
    var controllerList;
    var localNode;

    function addSelector(device) {
      var li = document.createElement('li');
      var input = document.createElement('input');
      input.setAttribute('id', 's_' + device.id);
      input.setAttribute('type', 'radio');
      input.setAttribute('name', 'device');
      var label = document.createElement('label');
      label.setAttribute('for', 's_' + device.id);
      if(device.type) {
        label.setAttribute('data-type', device.type);
      }
      label.textContent = device.name;
      if(!device.active) {
        li.setAttribute('data-inactive', '');
      } else {
        if(device.id === localNode) {
          li.setAttribute('data-local', '');
        }
      }
      li.appendChild(input);
      li.appendChild(label);
      return li;
    }

    return function(parsedNodeList) {
      setStatus('Registering devices');

      localNode = parsedNodeList.local;
      var controllerMap = new Map();
      if(!controllerList) {
        controllerList = document.querySelector('#controllers ol');
      }

      for(var i = 0; i < parsedNodeList.devices.length; i++) {
        var e = addSelector(parsedNodeList.devices[i]);
        controllerList.appendChild(e);
        controllerMap.set(parsedNodeList.devices[i].id, {
          html: e,
          node: parsedNodeList.devices[i]
        });
      }
      return controllerMap;
    };
  })();

  var waitTime = (function() {
    var lastAttemptTime = Date.now();
    var maxTime = 60 * 60 * 1;
    var lastTime = 0;

    return function() {
      if(Date.now() - lastAttemptTime > 1000 * maxTime) {
        lastTime = 5;
      } else {
        lastTime = Math.max(5, Math.min(maxTime, lastTime * 2.5))|0;
      }
      lastAttemptTime = Date.now();
      return lastTime;
    };
  })();

  function retry(fn, reason) {
    function timedRetry(reason) {
      var time = waitTime();
      setStatus(reason + '. Trying again in ${time} seconds', time);
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          resolve(fn());
        }, time * 1000);
      });
    }
    if(!reason) {
      return function(reason) {
        return timedRetry(reason);
      };
    } else {
      return timedRetry(reason);
    }
  }

  function init() {
    setStatus('Running startup');

    getCredentials()
      .then(getNodeList)
      .then(parseNodes)
      .then(registerDevices)
      .then(function(value) {
        setStatus('Monitoring');
      }, function(reason) {
        if(reason.message === '401: Unauthorized') {
          init();
        } else {
          retry(init, reason);
        }
      });
  }

  function main() {
    init();
  }

  window.onload = function() {
    main();
  };
})();