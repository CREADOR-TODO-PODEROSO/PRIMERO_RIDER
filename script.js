(() => {
    // aqui guardamos todo el estado de la aplicacion cliente servidor y el cache
    const state = {
        client: {},
        server: {},
        cache: [],
        activeId: null
    };

    // shortcut para acceder a elementos del DOM por id mas facil y rapido
    const $ = id => document.getElementById(id);

    function log(elId, text) {
        const el = $(elId);
        if (!el) return;
        const d = document.createElement('div');
        d.textContent = text;
        d.className = 'log-line';
        el.appendChild(d);
        el.scrollTop = el.scrollHeight;
    }

    function registroAccion(targetId, text) {
        const el = $(targetId);
        if (!el) return;
        const b = document.createElement('div');
        b.className = 'action-bubble ' + (targetId === 'clienteAcciones' ? 'client' : 'server');
        b.textContent = text;
        el.appendChild(b);
        el.scrollTop = el.scrollHeight;
    }

    function prettySet(elId, obj) {
        const el = $(elId);
        if (!el) return;
        el.textContent = JSON.stringify(obj, null, 2);
    }

    function toPathArray(path) {
        if (!path) return [];
        return Array.isArray(path) ? path : String(path).split('.');
    }

    function getAt(obj, path) {
        const keys = toPathArray(path);
        return keys.reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj);
    }

    function setAt(obj, path, value) {
        const keys = toPathArray(path);
        if (!keys.length) return;
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
            cur = cur[k];
        }
        cur[keys[keys.length - 1]] = value;
    }

    function renameAt(obj, path, newKey) {
        const keys = toPathArray(path);
        if (!keys.length) return obj;
        const last = keys.pop();
        const parent = keys.length ? getAt(obj, keys) : obj;
        if (!parent || typeof parent !== 'object') return obj;
        const entries = Object.entries(parent);
        const newParent = {};
        for (const [k, v] of entries) {
            if (k === last) newParent[newKey] = v;
            else newParent[k] = v;
        }
        if (!keys.length) return newParent; 
        const clone = JSON.parse(JSON.stringify(obj));
        let cur = clone;
        for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
        cur[keys[keys.length - 1]] = newParent;
        return clone;
    }

    function applyRenameToCache(path, newKey) {
        state.cache = state.cache.map(it => renameAt(it, path, newKey));
    }

    function actualizarSelectorClaves(obj) {
        const keySel = $('keySelector');
        const nested = $('nestedSelectors');
        if (!keySel) return;
        keySel.innerHTML = '';
        if (nested) nested.innerHTML = '';
        Object.keys(obj || {}).forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k; keySel.appendChild(o);
        });
        if (keySel.options.length) {
            keySel.selectedIndex = 0;
            const first = keySel.value;
            const val = obj ? obj[first] : undefined;
            if (val && typeof val === 'object' && !Array.isArray(val)) buildNestedSelectorsFor([first], obj);
        }
    }

    // construye selectores anidados para acceder a propiedades profundas de los objetos
    function buildNestedSelectorsFor(pathRoot, baseObj) {
        const container = $('nestedSelectors');
        if (!container) return;
        container.innerHTML = '';
        const root = pathRoot && pathRoot[0];
        if (!root) return;
        let curPath = [root];
        let val = getAt(baseObj, curPath);
        // sigue creando selectores mientras encuentre objetos anidados
        while (val && typeof val === 'object' && !Array.isArray(val)) {
            const s = document.createElement('select'); s.className = 'select nested';
            for (const k of Object.keys(val)) { const o = document.createElement('option'); o.value = k; o.textContent = k; s.appendChild(o); }
            const level = container.querySelectorAll('select').length;
            const wanted = pathRoot[level + 1];
            if (wanted && Array.from(s.options).some(o => o.value === wanted)) s.value = wanted;
            s.onchange = (ev) => {
                const children = Array.from(container.querySelectorAll('select'));
                const idx = children.indexOf(ev.target);
                const keys = [ $('keySelector') ? $('keySelector').value : '' ];
                for (let i = 0; i <= idx; i++) keys.push(children[i].value);
                const dir = $('direccion') ? $('direccion').value : 'cliente-servidor';
                const base = dir === 'cliente-servidor' ? state.client : state.server;
                buildNestedSelectorsFor(keys, base);
            };
            container.appendChild(s);
            curPath.push(s.value);
            val = getAt(baseObj, curPath);
        }

        try {
            // actualiza el valor del input cuando cambias la seleccion
            const finalPath = getSelectedPath();
            const dir = $('direccion') ? $('direccion').value : 'cliente-servidor';
            const base = dir === 'cliente-servidor' ? state.client : state.server;
            const v = getAt(base, finalPath);
            const nv = $('newValue'); if (nv) nv.value = v === undefined ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
        } catch (e) {  }
    }

    // obtiene la ruta actual basada en la seleccion del usuario en los selectores
    function getSelectedPath() {
        const keyEl = $('keySelector');
        const container = $('nestedSelectors');
        const path = [];
        if (!keyEl) return path;
        const key = keyEl.value;
        if (!key) return path;
        path.push(key);
        if (!container) return path;
        const children = Array.from(container.querySelectorAll('select'));
        for (const s of children) path.push(s.value);
        return path;
    }

    // descarga datos desde la api publica de jsonplaceholder y los carga en el estado
    async function obtenerDatos() {
        limpiarConsola();
        const url = 'https://jsonplaceholder.typicode.com/users';
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const datos = await r.json();
            // guarda los datos en el cache y carga el primero en el cliente
            state.cache = datos.map(d => JSON.parse(JSON.stringify(d)));
            state.client = datos[0] ? JSON.parse(JSON.stringify(datos[0])) : {};
            state.server = {};
            const idSel = $('idSelector');
            if (idSel) {
                idSel.innerHTML = '';
                datos.forEach(item => { const o = document.createElement('option'); o.value = item.id; o.textContent = `ID: ${item.id}`; idSel.appendChild(o); });
                // cuando cambias el id carga ese usuario en el cliente
                idSel.onchange = () => {
                    const id = parseInt(idSel.value, 10);
                    const found = state.cache.find(it => it.id === id);
                    if (found) { state.client = JSON.parse(JSON.stringify(found)); actualizarSelectorClaves(state.client); prettySet('estadoCliente', state.client); }
                };
            }
            actualizarSelectorClaves(state.client);
            prettySet('estadoCliente', state.client);
            prettySet('estadoServidor', state.server);
            log('clienteLog', `Cliente: ${datos.length} usuarios cargados`);
            log('servidorLog', `Servidor: listo`);
        } catch (err) {
            log('clienteLog', 'Error al obtener datos: ' + err.message);
        }
    }

    // copia los datos del cliente al servidor
    function enviarDatos() {
        try {
            state.server = JSON.parse(JSON.stringify(state.client));
            prettySet('estadoServidor', state.server);
            registroAccion('clienteAcciones', 'Cliente aplica JSON.stringify() y envía datos');
            registroAccion('servidorAcciones', 'Servidor aplica JSON.parse() y recibe datos');
        } catch (e) { alert('Error al enviar datos: ' + e.message); }
    }

    // edita valores o nombres de claves en el objeto seleccionado
    function editarJSON() {
        const editType = $('editType') ? $('editType').value : 'value';
        const direccion = $('direccion') ? $('direccion').value : 'cliente-servidor';
        const newValueInput = $('newValue') ? $('newValue').value : '';
        try {
            const path = getSelectedPath();
            if (!path.length) { alert("Selecciona una clave en 'Campo' para editar"); return; }
            const lastKey = path[path.length - 1];
            const targetClient = direccion === 'cliente-servidor';
            if (editType === 'value') {
                // intenta parsear como json si no lo es usa el string directamente
                let parsed;
                try { parsed = JSON.parse(newValueInput); } catch { parsed = newValueInput; }
                if (targetClient) setAt(state.client, path, parsed);
                else setAt(state.server, path, parsed);
            } else { 
                // cambia el nombre de la clave
                const newKey = (newValueInput || '').trim();
                if (!newKey) { alert('Debes ingresar el nuevo nombre de la clave'); return; }
                if (targetClient) {
                    state.client = renameAt(state.client, path, newKey);
                    applyRenameToCache(path, newKey);
                    actualizarSelectorClaves(state.client);
                } else {
                    state.server = renameAt(state.server, path, newKey);
                    applyRenameToCache(path, newKey);
                    actualizarSelectorClaves(state.server);
                }
            }
            if (targetClient) {
                prettySet('estadoCliente', state.client);
                registroAccion('clienteAcciones', `Se editó ${editType === 'value' ? 'valor' : 'clave'} en Cliente`);
            } else {
                // cuando editas el servidor envia los cambios de vuelta al cliente
                prettySet('estadoServidor', state.server);
                registroAccion('servidorAcciones', `Se editó ${editType === 'value' ? 'valor' : 'clave'} en Servidor`);
                registroAccion('servidorAcciones', 'Servidor aplica JSON.stringify() y envía datos');
                state.client = JSON.parse(JSON.stringify(state.server));
                prettySet('estadoCliente', state.client);
                registroAccion('clienteAcciones', 'Cliente aplica JSON.parse() y recibe datos');
            }
            if ($('newValue')) $('newValue').value = '';
        } catch (err) { alert('Error al editar JSON: ' + err.message); }
    }

    // expone las funciones al scope global para que puedas usarlas desde html
    window.enviarDatos = enviarDatos;
    window.editarJSON = editarJSON;
    window.obtenerDatos = obtenerDatos;

    // limpia el area de output
    function limpiarConsola() { const o = $('output'); if (o) o.textContent = ''; }

    // cuando el dom carga configura los event listeners iniciales
    document.addEventListener('DOMContentLoaded', () => {
        const keySel = $('keySelector');
        // cuando cambias la clave actualiza los selectores anidados
        if (keySel) keySel.onchange = () => {
            const dir = $('direccion') ? $('direccion').value : 'cliente-servidor';
            const base = dir === 'cliente-servidor' ? state.client : state.server;
            buildNestedSelectorsFor([keySel.value], base);
        };
        const dirEl = $('direccion');
        // cuando cambias entre cliente y servidor actualiza las claves disponibles
        if (dirEl) dirEl.onchange = () => {
            const d = dirEl.value;
            if (d === 'cliente-servidor') actualizarSelectorClaves(state.client);
            else actualizarSelectorClaves(state.server);
        };
        const idSel = $('idSelector');
        if (idSel) idSel.disabled = false;
        // carga los datos iniciales
        obtenerDatos();
    });
})();
