'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const colors = require('colors/safe')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const uglify = require('uglify-es')

module.exports = Promise.mapSeries([
  /**
   * SimpleMDE
   */
  () => {
    return fs.accessAsync('./assets/js/simplemde').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('SimpleMDE directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy + Minify SimpleMDE to assets...'))
        return fs.copy('./node_modules/simplemde/dist/simplemde.min.js', './assets/js/simplemde/simplemde.min.js')
      } else {
        throw err
      }
    })
  },
  /**
   * ACE Modes
   */
  () => {
    return fs.accessAsync('./assets/js/ace').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('ACE modes directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy + Minify ACE modes to assets...'))
        return fs.ensureDirAsync('./assets/js/ace').then(() => {
          return Promise.join(
            // Core
            Promise.all([
              fs.readFileAsync('./node_modules/brace/index.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/ext/modelist.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/theme/dawn.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/theme/tomorrow_night.js', 'utf8'),
              fs.readFileAsync('./node_modules/brace/mode/markdown.js', 'utf8')
            ]).then(items => {
              console.info(colors.white('      ace.js'))
              let result = uglify.minify(items.join(';\n'), { output: { 'max_line_len': 1000000 } })
              return fs.writeFileAsync('./assets/js/ace/ace.js', result.code)
            }),
            // Modes
            fs.readdirAsync('./node_modules/brace/mode').then(modeList => {
              return Promise.map(modeList, mdFile => {
                return fs.readFileAsync(path.join('./node_modules/brace/mode', mdFile), 'utf8').then(modeCode => {
                  console.info(colors.white('      mode-' + mdFile))
                  let result = uglify.minify(modeCode, { output: { 'max_line_len': 1000000 } })
                  return fs.writeFileAsync(path.join('./assets/js/ace', 'mode-' + mdFile), result.code)
                })
              }, { concurrency: 3 })
            })
          )
        })
      } else {
        throw err
      }
    })
  },
  /**
   * MathJax
   */
  () => {
    return fs.accessAsync('./assets/js/mathjax').then(() => {
      console.info(colors.white('  └── ') + colors.magenta('MathJax directory already exists. Task aborted.'))
      return true
    }).catch(err => {
      if (err.code === 'ENOENT') {
        console.info(colors.white('  └── ') + colors.green('Copy MathJax dependencies to assets...'))
        return fs.ensureDirAsync('./assets/js/mathjax').then(() => {
          return fs.copyAsync('./node_modules/mathjax', './assets/js/mathjax', {
            filter: (src, dest) => {
              let srcNormalized = src.replace(/\\/g, '/')
              let shouldCopy = false
              console.info(colors.white('      ' + srcNormalized))
              _.forEach([
                '/node_modules/mathjax',
                '/node_modules/mathjax/jax',
                '/node_modules/mathjax/jax/input',
                '/node_modules/mathjax/jax/output'
              ], chk => {
                if (srcNormalized.endsWith(chk)) {
                  shouldCopy = true
                }
              })
              _.forEach([
                '/node_modules/mathjax/extensions',
                '/node_modules/mathjax/MathJax.js',
                '/node_modules/mathjax/jax/element',
                '/node_modules/mathjax/jax/input/MathML',
                '/node_modules/mathjax/jax/input/TeX',
                '/node_modules/mathjax/jax/output/SVG'
              ], chk => {
                if (srcNormalized.indexOf(chk) > 0) {
                  shouldCopy = true
                }
              })
              if (shouldCopy && srcNormalized.indexOf('/fonts/') > 0 && srcNormalized.indexOf('/STIX-Web') <= 1) {
                shouldCopy = false
              }
              return shouldCopy
            }
          })
        })
      } else {
        throw err
      }
    })
  },
  /**
   * i18n
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Copying i18n client files...'))
    return fs.ensureDirAsync('./assets/js/i18n').then(() => {
      return fs.readJsonAsync('./server/locales/en/browser.json').then(enContent => {
        return fs.readdirAsync('./server/locales').then(langs => {
          return Promise.map(langs, lang => {
            console.info(colors.white('      ' + lang + '.json'))
            let outputPath = path.join('./assets/js/i18n', lang + '.json')
            return fs.readJsonAsync(path.join('./server/locales', lang + '.json'), 'utf8').then((content) => {
              return fs.outputJsonAsync(outputPath, _.defaultsDeep(content, enContent))
            }).catch(err => { // eslint-disable-line handle-callback-err
              return fs.outputJsonAsync(outputPath, enContent)
            })
          })
        })
      })
    })
  },
  /**
   * Bundle pre-init scripts
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Bundling pre-init scripts...'))
    let preInitContent = ''
    return fs.readdirAsync('./client/js/pre-init').map(f => {
      let fPath = path.join('./client/js/pre-init/', f)
      return fs.readFileAsync(fPath, 'utf8').then(fContent => {
        preInitContent += fContent + ';\n'
      })
    }).then(() => {
      return fs.outputFileAsync('./.build/_preinit.js', preInitContent, 'utf8')
    })
  },
  /**
   * Delete Fusebox cache
   */
  () => {
    console.info(colors.white('  └── ') + colors.green('Clearing fuse-box cache...'))
    return fs.emptyDirAsync('./.fusebox')
  }
], f => { return f() })
