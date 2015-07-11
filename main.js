(function() {

  var resource = 'http://localhost:8080';
  var basicAuth = 'admin:password';

  var getNodeList = new Promise(function(resolve, reject) {
    var formData = new FormData();
    formData.append('nl', '*');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', resource + '/json', true, 'admin', 'password');
    xhr.onload = function(e) {
      if(this.status === 200) {
        try {
          resolve(JSON.parse(this.responseText));
        } catch(e) {
          reject(e);
        }
      } else {
        reject(this.status + ': ' + this.statusText + '.');
      }
    };
    xhr.onerror = function(e) {
      reject('Error occurred when requesting node list.');
    };

    xhr.send('nl=*');
  });

  function parseNodes(nodeList) {
    var devices = [];
    for(var node in nodeList.nodes) {
      for(var item in nodeList.nodes[node]) {
        if(/^DEV\d+$/.test(item)) {
          devices.push({
            id: node,
            device: item,
            deviceId: parseInt(/^DEV(\d+)$/.exec(item)[1], 10),
            name: nodeList.nodes[node][item],
            active: nodeList.nodes[node]['ZigBee'] === 0 || nodeList.nodes[node]['LOCAL'] === 0 || false
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

  var registerControllers = (function() {
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

  var main = (function() {
    var statusBar;

    return function() {
      if(!statusBar) {
        statusBar = document.querySelector('#status');
      }

      getNodeList.then(parseNodes).then(registerControllers).catch(function(e) {
        statusBar.textContent = e + ' Please try again.';
      });
    }
  })();

  window.onload = function() {
    main();
  };
})();