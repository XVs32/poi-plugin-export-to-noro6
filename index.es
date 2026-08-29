// index.es — poi-plugin-export-kcweb
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Button, Checkbox } from 'react-bootstrap'
import { get, values } from 'lodash'

const { clipboard, remote, shell } = window.require('electron')
const fs = window.require('fs')
const path = window.require('path')
const os = window.require('os')

function buildExportPayload(state, exportUnlocked) {
    const ships = get(state, 'info.ships', {})
    const equips = get(state, 'info.equips', {})

    const shipsToExport = values(ships)
        .filter(ship => ship && ship.api_id > 0 && ship.api_ship_id > 0)
        // If exportUnlocked is true, we bypass the api_locked constraint
        .filter(ship => exportUnlocked || ship.api_locked === 1)
        .map(ship => {
            const dto = {
                api_id: ship.api_id,
                api_ship_id: ship.api_ship_id,
                api_lv: ship.api_lv,
                api_kyouka: ship.api_kyouka,
                api_exp: ship.api_exp,
                api_slot_ex: ship.api_slot_ex,
                api_sally_area: ship.api_sally_area,
            }
            const spEffectItems = getSpEffectItemsForShip(ship, equips)
            if (spEffectItems.length > 0) {
                dto.api_sp_effect_items = spEffectItems
            }
            return dto
        })

    const gearsToExport = values(equips)
        .filter(gear => gear && gear.api_id > 0 && gear.api_slotitem_id > 0)
        // If exportUnlocked is true, we bypass the api_locked constraint
        .filter(gear => exportUnlocked || gear.api_locked === 1)
        .map(gear => {
            const dto = {
                api_id: gear.api_id,
                api_slotitem_id: gear.api_slotitem_id,
                api_level: gear.api_level,
            }
            if (gear.api_alv >= 0) dto.api_alv = gear.api_alv
            return dto
        })

    return { ships: shipsToExport, items: gearsToExport }
}

function getSpEffectItemsForShip(ship, equips) {
    return []
}

// Accepts exportUnlocked as a parameter to build the payload accordingly
function getKcwebUrl(state, exportUnlocked) {
    const { ships, items } = buildExportPayload(state, exportUnlocked)
    const objectToExport = { ships, items }
    // Percent-encode the JSON payload so it survives being passed through
    // to an external browser, matching what kc-web expects on its end
    // (it calls decodeURIComponent on the fragment).
    const encodedPayload = encodeURIComponent(JSON.stringify(objectToExport))
    return `https://noro6.github.io/kc-web#import:${encodedPayload}`
}

// Fixed filename: each export overwrites the same temp file rather than
// accumulating a new one every time.
const REDIRECT_FILE = path.join(os.tmpdir(), 'poi-kcweb-export.html')

@connect(state => ({ state }))
class ExportToKcweb extends Component {
    constructor(props) {
        super(props)
        // Read initial state from localStorage (default to false if not set)
        const savedSetting = localStorage.getItem('poi-plugin-export-kcweb:exportUnlocked')
        this.state = {
            exportUnlocked: savedSetting === 'true'
        }
    }

    handleCheckboxChange = (e) => {
        const checked = e.target.checked
        this.setState({ exportUnlocked: checked })
        localStorage.setItem('poi-plugin-export-kcweb:exportUnlocked', checked)
    }

    openNewPage = () => {
        const url = getKcwebUrl(this.props.state, this.state.exportUnlocked)

        // shell.openExternal has strict URL-length limits imposed by the
        // OS launcher (Brave/Chromium loses long URLs silently). To work
        // around this, write a small local redirect file and open that
        // instead — the launched URL is just a short file:// path, and
        // the redirect script inside handles navigating to the full,
        // long kc-web URL once the browser is already open.
        const redirectHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redirecting to kc-web…</title></head>
<body>
<script>window.location.replace(${JSON.stringify(url)});</script>
<p>Redirecting to kc-web… if nothing happens, <a href="${url}">click here</a>.</p>
</body>
</html>`

        fs.writeFile(REDIRECT_FILE, redirectHtml, 'utf8', err => {
            if (err) {
                console.error('Failed to write kc-web redirect file:', err)
                return
            }
            shell.openExternal(`file://${REDIRECT_FILE}`)
                .then(() => console.debug('Opened kc-web redirect file in default browser'))
                .catch(e => console.error('shell.openExternal failed:', e))
        })
    }

    copyLink = () => {
        const url = getKcwebUrl(this.props.state, this.state.exportUnlocked)
        clipboard.writeText(url)
        console.debug('Copied kc-web export URL to clipboard')
    }

    handleClick = e => {
        if (e.altKey) {
            this.copyLink()
            return
        }
        this.openNewPage()
    }

    render() {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                <Button bsStyle="primary" onClick={this.handleClick}>
                    Export to kc-web (Alt+Click to copy link)
                </Button>
                <Checkbox
                    checked={this.state.exportUnlocked}
                    onChange={this.handleCheckboxChange}
                    style={{ margin: 0, fontSize: '12px' }}
                >
                    Include unlocked ships and equipment
                </Checkbox>
            </div>
        )
    }
}

export const reactClass = ExportToKcweb
export const pluginDidLoad = () => { }