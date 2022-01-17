import EventEmitter from 'events'
import { argv } from './const'
import { watchLoad } from './watchLoad'

export const CFG_ALLOW_CLEAR_TEXT_LOGIN = 'allow clear text login'

const PATH = 'config.yaml'

let started = false
let state:Record<string,any> = {}
const emitter = new EventEmitter()
const path = argv.config || process.env.hfs_config || PATH
watchLoad(path,  data => {
    started = true
    setConfig(data)
}, { failOnFirstAttempt:()=> setConfig({}) })

const configProps:Record<string, ConfigProps> = {}

interface ConfigProps {
    defaultValue?:any,
    caster?:(argV:string)=>any
}
export function defineConfig(k:string, definition:ConfigProps) {
    configProps[k] = definition
    if (!definition.caster)
        if (typeof definition.defaultValue === 'number')
            definition.caster = Number
}

export function subscribeConfig({ k, ...definition }:{ k:string } & ConfigProps, cb:(v:any, was?:any)=>void) {
    if (definition)
        defineConfig(k, definition)
    const { caster, defaultValue } = configProps[k] ?? {}
    const a = argv[k]
    if (a !== undefined)
        return cb(caster ? caster(a) : a)
    emitter.on('new.'+k, cb)
    if (!started) return
    let v = state[k]
    if (v === undefined)
        v = defaultValue
    if (v !== undefined)
        cb(v)
}

export function getConfig(k:string) {
    return state[k]
}

export function setConfig(newCfg: Record<string,any>) {
    for (const k in newCfg)
        check(k)
    const oldKeys = Object.keys(state)
    oldKeys.push(...Object.keys(configProps))
    for (const k of oldKeys)
        if (!newCfg.hasOwnProperty(k))
            check(k)

    function check(k: string) {
        const oldV = state[k]
        const newV = newCfg[k]
        const { caster, defaultValue } = configProps[k] ?? {}
        let v = newV === undefined ? defaultValue : newV
        if (caster)
            v = caster(v)
        if (JSON.stringify(v) === JSON.stringify(oldV)) return
        state[k] = v
        emitter.emit('new.'+k, v, oldV)
    }
}
