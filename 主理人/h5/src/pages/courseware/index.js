import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 课件下载（设计稿 29）。
 *
 * 小程序**不能直接把任意域名的文件存到用户设备**（wx.downloadFile 受合法域名限制，
 * 且非图片类型无法存进相册/文件），所以「下载」= 记录下载状态 + 复制真实地址，
 * 由用户在浏览器里打开保存。这一点在页面上如实写出来，
 * 不做一个点了转圈然后什么都没发生的假下载。
 *
 * 「已下载 / 未下载」是真实状态（`course_material_download` 一人一件一行），
 * 不是本地标记——换设备登录同一账号仍然看得到。
 */
const api = require('../../api/mp.js')
const { toast, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiRing from '../../components/ring/index'
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
function sizeText(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1048576
  return mb >= 1 ? mb.toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB'
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    courseId: 0,
    courseTitle: '',
    materials: [],
    downloadedCount: 0,
    downloadedPct: 0,
    updatedText: '—',
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          courseId: Number((options && options.id) || 0),
        },
        navVars()
      )
    )
    this.load()
  },
  async load() {
    if (!this.data.courseId) {
      this.setData({
        loading: false,
        materials: [],
      })
      return
    }
    this.setData({
      retrying: true,
    })
    try {
      const c = await api.getCourseSession(this.data.courseId)
      const materials = (c.materials || []).map((m) =>
        Object.assign({}, m, {
          sizeText: sizeText(m.size_bytes),
        })
      )
      const done = materials.filter((m) => m.downloaded).length
      const latest = materials
        .map((m) => m.updated_at)
        .filter(Boolean)
        .sort()
        .pop()
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        courseTitle: c.title,
        materials,
        downloadedCount: done,
        downloadedPct: materials.length
          ? Math.round((done * 100) / materials.length)
          : 0,
        updatedText: latest ? d10(latest) : '—',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('courseware load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  async download(e) {
    const { id } = getTarget(e.currentTarget, Taro).dataset
    try {
      const r = await api.recordDownload(Number(id))
      Taro.setClipboardData({
        data: r.url,
        success: () =>
          Taro.showModal({
            title: '链接已复制',
            content:
              '文件地址已复制，可在微信内置浏览器或系统浏览器中打开保存。',
            showCancel: false,
          }),
      })
      this.load()
    } catch (err) {
      toast(err.message)
    }
  },
  /** 复制全部链接：一次给一份清单，比逐个点更实用 */
  downloadAll() {
    const list = this.data.materials
    if (!list.length) {
      toast('这节课还没有课件')
      return
    }
    const text = list.map((m) => m.name + '：' + m.url).join('\n')
    Taro.setClipboardData({
      data: text,
      success: () => {
        toast('已复制 ' + list.length + ' 条链接')
        // 复制全部也算下载动作，逐个补记状态（失败不打扰用户）
        list.forEach((m) => api.recordDownload(m.id).catch(() => {}))
        setTimeout(() => this.load(), 800)
      },
    })
  },
  go(e) {
    const url = getTarget(e.currentTarget, Taro).dataset.url
    if (url)
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      err,
      retrying,
      loading,
      courseTitle,
      materials,
      downloadedPct,
      downloadedCount,
      updatedText,
      courseId,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="课件下载" home="/pages/training/index"></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          {loading ? (
            <View className="card card-pad">
              <View className="skeleton skeleton-block"></View>
            </View>
          ) : (
            <Block>
              <View className="card card--hero cw-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="title-grad cw-title">课件下载</View>
                    <Text className="lead mt-8">
                      课程资料、清单与模板统一领取
                    </Text>
                    <View
                      className="f f-wrap mt-12"
                      style={{
                        gap: '0.25rem',
                      }}
                    >
                      <View className="pill-outline">
                        <UiIcon name="crown" size={21} color="signal"></UiIcon>
                        <Text>会员专属</Text>
                      </View>
                      <View className="pill-outline">
                        <UiIcon
                          name="refresh"
                          size={21}
                          color="signal-600"
                        ></UiIcon>
                        <Text>资料同步</Text>
                      </View>
                    </View>
                  </View>
                  <UiArt kind="gem" w={210} icon="doc" variant="cw"></UiArt>
                </View>
              </View>
              <View className="card card-pad gap">
                <View className="f-between mb-10">
                  <Text className="col-h">{courseTitle || '本节课件'}</Text>
                  <Text className="t-tiny">{materials?.length + ' 项'}</Text>
                </View>
                {materials?.length ? (
                  <Block>
                    {materials?.map((item, index) => {
                      return (
                        <View key={item.id} className="file-row">
                          <Text className="file-ext">{item.file_ext}</Text>
                          <View className="f-1">
                            <Text className="file-t">{item.name}</Text>
                            {item.description && (
                              <Text className="t-tiny mt-4 block">
                                {item.description}
                              </Text>
                            )}
                          </View>
                          <View className="ta-r">
                            <Text className="t-tiny mono block">
                              {item.sizeText}
                            </Text>
                            <Text
                              className="t-micro block"
                              style={{
                                color: `var(--${
                                  item.downloaded ? 'ok' : 'ink-600'
                                })`,
                              }}
                            >
                              {item.downloaded ? '已下载' : '未下载'}
                            </Text>
                          </View>
                          <View
                            className="dl-circle"
                            data-id={item.id}
                            data-url={item.url}
                            onClick={this.download}
                          >
                            <UiIcon
                              name="download"
                              size={28}
                              color="signal"
                            ></UiIcon>
                          </View>
                        </View>
                      )
                    })}
                    <View className="dl-stat">
                      <View className="dl-stat-i">
                        <UiRing
                          pct={downloadedPct}
                          size={64}
                          color="signal-600"
                          label={downloadedPct + '%'}
                          labelSize={11}
                          labelColor="ink"
                        ></UiRing>
                        <View>
                          <Text className="vs-t">已下载</Text>
                          <Text className="vs-d mono">
                            {downloadedCount +
                              ' / ' +
                              materials?.length +
                              ' 项'}
                          </Text>
                        </View>
                      </View>
                      <View className="dl-stat-i">
                        <UiIcon name="clock" size={42} color="signal"></UiIcon>
                        <View>
                          <Text className="vs-t">最近更新</Text>
                          <Text className="vs-d mono">{updatedText}</Text>
                        </View>
                      </View>
                    </View>
                  </Block>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="folder" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">这节课还没有课件</Text>
                    <Text className="blank-hint">
                      课件由课程组在课后上传，上传后会在站内消息通知你。
                    </Text>
                  </View>
                )}
              </View>
              <View className="box box--sunk gap">
                <View
                  className="f"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="shield" size={28} color="signal"></UiIcon>
                  <Text className="t-sec fw-600">下载与使用说明</Text>
                </View>
                <Text className="t-tiny mt-6 block">
                  点击下载会复制文件地址并记录下载状态，在微信内置浏览器或系统浏览器中打开即可保存。
                  资料仅限会员本人使用，请勿外传或用于商业用途。
                </Text>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            <View className="cta cta--primary" onClick={this.downloadAll}>
              <UiIcon name="download" size={32} color="on-signal"></UiIcon>
              <Text>复制全部链接</Text>
            </View>
            <View
              className="cta cta--ghost"
              data-url={'/pages/course/index?id=' + courseId}
              onClick={this.go}
            >
              <UiIcon name="play" size={30} color="signal"></UiIcon>
              <Text>返回课程</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
