// index.es — poi-plugin-export-kcweb
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Button } from 'react-bootstrap'
import { get, values } from 'lodash'

const { clipboard, remote } = window.require('electron')
const { BrowserWindow } = remote

// Keep a persistent reference to the window outside the component instance
let kcwebWindow = null

function buildExportPayload(state) {
    const ships = get(state, 'info.ships', {})
    const equips = get(state, 'info.equips', {})

    const shipsToExport = values(ships)
        .filter(ship => ship && ship.api_id > 0 && ship.api_ship_id > 0)
        .filter(ship => ship.api_locked === 1)
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
        .filter(gear => gear.api_locked === 1)
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

// Matches KC3's actual output: no locale prefix, no predeck key
function getKcwebUrl(state) {
    const { ships, items } = buildExportPayload(state)
    const objectToExport = { ships, items }
    return `https://noro6.github.io/kc-web#import:${JSON.stringify(objectToExport)}`
}

@connect(state => ({ state }))
class ExportToKcweb extends Component {
    openNewPage = () => {
        const url = getKcwebUrl(this.props.state)

        // If the window exists and hasn't been closed by the user, reuse it
        if (kcwebWindow && !kcwebWindow.isDestroyed()) {
            kcwebWindow.loadURL(url)

            if (kcwebWindow.isMinimized()) {
                kcwebWindow.restore()
            }
            kcwebWindow.focus()
        } else {
            // Otherwise, create a new window
            kcwebWindow = new BrowserWindow({ show: false })
            kcwebWindow.maximize()

            kcwebWindow.once('ready-to-show', () => {
                kcwebWindow.show()
            })

            // Reset reference to null when the window is closed
            kcwebWindow.on('closed', () => {
                kcwebWindow = null
            })

            kcwebWindow.loadURL(url)
        }
    }

    copyLink = () => {
        const url = getKcwebUrl(this.props.state)
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
            <Button bsStyle="primary" onClick={this.handleClick}>
                Export to kc-web (Alt+Click to copy link)
            </Button>
        )
    }
}

export const reactClass = ExportToKcweb
export const pluginDidLoad = () => { }