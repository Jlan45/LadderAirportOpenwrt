'use strict';
'require view';
'require ui';
'require fs';
'require poll';
'require dom';

function yn(v) {
	return v ? _('yes') : _('no');
}

function fmtBytes(n) {
	n = Number(n) || 0;
	if (n < 1024)
		return n + ' B';
	if (n < 1048576)
		return (n / 1024).toFixed(1) + ' KiB';
	if (n < 1073741824)
		return (n / 1048576).toFixed(2) + ' MiB';
	return (n / 1073741824).toFixed(2) + ' GiB';
}

function row(label, value) {
	return E('tr', {}, [
		E('td', { 'class': 'td left', 'width': '35%' }, [label]),
		E('td', { 'class': 'td left' }, [value == null || value === '' ? '—' : String(value)])
	]);
}

function loadStatus() {
	return fs.exec_direct('/usr/libexec/ladder-agent/luci-status.sh', []).then(function (text) {
		text = (text || '').trim();
		if (!text)
			throw new Error(_('Empty status output'));
		return JSON.parse(text);
	});
}

function serviceAction(action) {
	return fs.exec('/etc/init.d/ladder-agent', [action]).then(function (res) {
		if (res.code)
			ui.addNotification(null, E('p', _('%s failed (exit %s): %s').format(
				action, res.code, (res.stderr || res.stdout || '').trim() || _('unknown'))), 'error');
		else
			ui.addNotification(null, E('p', _('Service action “%s” completed.').format(action)), 'info');
	}).catch(function (err) {
		ui.addNotification(null, E('p', _('Service action failed: %s').format(err)), 'error');
	});
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function () {
		return loadStatus().catch(function (err) {
			return { _error: String(err) };
		});
	},

	render: function (data) {
		var table = E('table', { 'class': 'table', 'id': 'ladder-agent-status-table' });
		var banner = E('div', { 'id': 'ladder-agent-status-error' });

		function fill(st) {
			dom.content(table, []);
			dom.content(banner, []);

			if (!st || st._error) {
				banner.appendChild(E('div', { 'class': 'alert-message warning' }, [
					_('Failed to read status: %s').format(st && st._error ? st._error : _('unknown'))
				]));
				return;
			}

			var mode = st.uplink
				? (st.uplink_serve_grpc ? _('uplink + gRPC') : _('uplink'))
				: _('push (gRPC)');

			table.appendChild(E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, [_('Field')]),
				E('th', { 'class': 'th left' }, [_('Value')])
			]));
			table.appendChild(row(_('Process running'), yn(!!st.running)));
			table.appendChild(row(_('PID'), st.pid || '—'));
			table.appendChild(row(_('UCI enabled'), yn(!!st.enabled)));
			table.appendChild(row(_('Init enabled'), yn(!!st.init_enabled)));
			table.appendChild(row(_('Agent version'), st.version || '—'));
			table.appendChild(row(_('Control mode'), mode));
			table.appendChild(row(_('Uplink WebSocket'), st.uplink ? yn(!!st.uplink_ws) : '—'));
			table.appendChild(row(_('Panel URL'), st.panel_url || '—'));
			table.appendChild(row(_('Node ID'), st.node_id || '—'));
			table.appendChild(row(_('Control token'), st.token_set
				? _('set (%s)').format(st.token_masked || '***')
				: _('not set')));
			table.appendChild(row(_('Enroll token pending'), yn(!!st.enroll_token_set)));
			table.appendChild(row(_('Listen'), st.listen || '—'));
			table.appendChild(row(_('Data directory'), st.data_dir || '—'));
			table.appendChild(row(_('Report address'), st.report_address || '—'));
			table.appendChild(row(_('Applied config'), st.has_config
				? _('yes (%s, %s inbounds)').format(fmtBytes(st.config_bytes), st.inbound_count || 0)
				: _('no (waiting for Panel)')));
			table.appendChild(row(_('Inbound types'), st.inbound_types || '—'));
			table.appendChild(row(_('FRPS config present'), yn(!!st.has_frps)));
			table.appendChild(row(_('Traffic uplink (persisted)'), fmtBytes(st.uplink_bytes)));
			table.appendChild(row(_('Traffic downlink (persisted)'), fmtBytes(st.downlink_bytes)));
			if (st.collected_at_unix)
				table.appendChild(row(_('Collected at'), new Date(st.collected_at_unix * 1000).toLocaleString()));
		}

		fill(data);

		var buttons = E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function () {
					return loadStatus().then(fill).catch(function (err) {
						fill({ _error: String(err) });
					});
				})
			}, [_('Refresh')]),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'click': ui.createHandlerFn(this, function () {
					return serviceAction('start').then(function () { return loadStatus().then(fill); });
				})
			}, [_('Start')]),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(this, function () {
					return serviceAction('stop').then(function () { return loadStatus().then(fill); });
				})
			}, [_('Stop')]),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function () {
					return serviceAction('restart').then(function () { return loadStatus().then(fill); });
				})
			}, [_('Restart')]),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-save',
				'click': ui.createHandlerFn(this, function () {
					return serviceAction('enable');
				})
			}, [_('Enable on boot')]),
			' ',
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, function () {
					return serviceAction('disable');
				})
			}, [_('Disable on boot')])
		]);

		poll.add(function () {
			return loadStatus().then(fill).catch(function (err) {
				fill({ _error: String(err) });
			});
		}, 10);

		return E([], [
			E('h2', {}, [_('LadderAirport node status')]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Local view of this router’s ladder-agent process, UCI settings, applied proxy config, and persisted traffic counters. Live Panel metrics require the agent uplink/push path.')
			]),
			banner,
			E('div', { 'class': 'cbi-section' }, [table]),
			buttons
		]);
	}
});
