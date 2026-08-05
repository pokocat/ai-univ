import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button, Image, Input } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 完善资料弹层：头像 + 昵称一次设置。
 *
 * 微信「头像昵称填写能力」是配套的一对（chooseAvatar + input type=nickname），
 * 此前只做了昵称半边，头像一直是文字首字占位。两者放同一个弹层，用户设置一次即可，
 * 也避免"改完昵称还得再找个地方传头像"。
 *
 * 保存语义：本地先预览、点保存才落库。头像与昵称各自独立提交——
 * 只改了头像就不打昵称接口，反之亦然，避免无谓写库和多余的时间线留痕。
 * 头像上传失败不吞掉昵称的修改结果（分别报错，已成功的部分不回滚）。
 */
const api = require('../../api/mp.js')
const { base } = require('../../utils/auth.js')
const { maskPhone, toast } = require('../../utils/fmt.js')
import UiSheet from '../sheet/index'
import './index.scss'
const DEFAULT_NAME = '微信用户'
cacheOptions.setOptionsToCache({
  properties: {
    /** 当前头像相对路径（后端 avatarPath） */
    avatarPath: {
      type: String,
      value: '',
    },
    /** 当前昵称 */
    name: {
      type: String,
      value: '',
    },
    /** 标题与副标题（登录后引导 / 我的页编辑，措辞不同） */
    title: {
      type: String,
      value: '完善资料',
    },
    subtitle: {
      type: String,
      value: '',
    },
    /** 首次注册登录为 true：手机号未验证时不允许完成。 */
    phoneRequired: {
      type: Boolean,
      value: false,
    },
    /** 首次注册登录为 true：默认昵称或空昵称不允许完成。 */
    nameRequired: {
      type: Boolean,
      value: false,
    },
    /** 已绑定手机号的脱敏展示；空串表示尚未绑定。 */
    phoneText: {
      type: String,
      value: '',
    },
  },
  data: {
    /** chooseAvatar 选中的本地临时文件路径（未保存前只做预览） */
    tempAvatar: '',
    avatarSrc: '',
    avatarChar: '主',
    nickInput: '',
    hasNickname: false,
    saving: false,
    canSave: false,
    phoneDisplay: '',
    phoneBinding: false,
    privacyReady: false,
    privacyAgreed: false,
    phoneScopeError: '',
    /** 提交按钮文案：置灰时直接说明卡在哪一步，见 computeSubmitLabel */
    submitLabel: '保存修改',
    ready: false, // 首次 attached 后再回填，避免 observer 早于 properties 就绪
  },
  observers: {
    'avatarPath, name'() {
      this.resetProfile()
    },
    phoneText(phoneText) {
      this.setData({
        phoneDisplay: phoneText || '',
      })
    },
    /** 门禁相关字段一变就刷新按钮文案，避免每个 setData 调用点各写一遍 */
    'phoneRequired, nameRequired, phoneDisplay, hasNickname'() {
      this.setData({
        submitLabel: this.computeSubmitLabel(),
      })
    },
  },
  lifetimes: {
    attached() {
      this.resetProfile()
      this.setData({
        phoneDisplay: this.data.phoneText || '',
      })
      this.refreshPrivacySetting()
    },
  },
  methods: {
    /**
     * 提交按钮文案。按钮常驻可见，缺什么就在按钮上说什么——
     * 上一版是「凑齐之前整个按钮不渲染」，用户看到一张没有提交入口的表，
     * 既不知道还差什么，也不知道填完会发生什么。
     */
    computeSubmitLabel() {
      if (this.data.phoneRequired && !this.data.phoneDisplay)
        return '请先验证手机号'
      if (this.data.nameRequired && !this.data.hasNickname) return '请填写昵称'
      return this.data.phoneRequired ? '完成注册并进入' : '保存修改'
    },
    /** 先把微信侧的隐私授权状态映射成可见 UI，避免用户被提示去找不存在的入口。 */
    refreshPrivacySetting() {
      if (!Taro.getPrivacySetting) {
        this.setData({
          privacyReady: true,
          privacyAgreed: true,
        })
        return
      }
      Taro.getPrivacySetting({
        success: (result) => {
          this.setData({
            privacyReady: true,
            privacyAgreed: !(result && result.needAuthorization),
          })
        },
        fail: () =>
          this.setData({
            privacyReady: true,
            privacyAgreed: false,
          }),
      })
    },
    openPrivacyContract() {
      if (!Taro.openPrivacyContract) {
        toast('当前微信版本不支持查看，请升级微信')
        return
      }
      Taro.openPrivacyContract({
        fail: () => toast('隐私保护指引打开失败，请稍后重试'),
      })
    },
    /** open-type 会把用户选择同步给微信；本地只负责推进到手机号验证按钮。 */
    onAgreePrivacy() {
      this.setData({
        privacyReady: true,
        privacyAgreed: true,
        phoneScopeError: '',
      })
      Taro.showToast({
        title: '请继续验证手机号',
        icon: 'none',
      })
    },
    /** 打开/属性变化时回填：默认昵称视为"没填过"，输入框留空让用户自己写 */
    resetProfile() {
      const name = this.data.name || ''
      const normalizedName = name.trim()
      this.setData({
        tempAvatar: '',
        avatarSrc: this.data.avatarPath
          ? `${base()}${this.data.avatarPath}`
          : '',
        avatarChar: (name || '主').trim().charAt(0) || '主',
        nickInput: name === DEFAULT_NAME ? '' : name,
        hasNickname: !!normalizedName && normalizedName !== DEFAULT_NAME,
        canSave: false,
        ready: true,
      })
    },
    /**
     * 首次注册登录的手机号验证。绑定接口成功即已落库；随后仍留在弹层中，
     * 让用户确认资料并通过「完成并进入」结束本次注册引导。
     */
    async onPhone(e) {
      const code = e && e.detail ? e.detail.code : ''
      if (!code) {
        const errMsg = (e && e.detail && e.detail.errMsg) || ''
        if (errMsg.indexOf('scope is not declared') >= 0) {
          this.setData({
            phoneScopeError: '手机号验证暂未配置完成，请稍后再试',
            privacyReady: true,
          })
          toast('手机号验证暂不可用')
          return
        }
        if (errMsg.indexOf('privacy') >= 0) {
          this.setData({
            phoneScopeError: '',
            privacyReady: true,
            privacyAgreed: false,
          })
          toast('请先同意下方《小程序隐私保护指引》')
          return
        }
        if (errMsg.indexOf('deny') >= 0) {
          toast('完成注册需要验证手机号')
          return
        }
        toast('当前环境暂不支持手机号快速验证')
        return
      }
      if (this.data.phoneBinding) return
      this.setData({
        phoneBinding: true,
      })
      try {
        const r = await api.bindPhone(code)
        const phoneDisplay = maskPhone(r && r.phone)
        this.setData({
          phoneDisplay,
          canSave: true,
          phoneScopeError: '',
        })
        this.triggerEvent('phonebound', {
          phoneText: phoneDisplay,
        })
        Taro.showToast({
          title: '手机号已验证',
          icon: 'success',
        })
      } catch (err) {
        toast(err.message)
      } finally {
        this.setData({
          phoneBinding: false,
        })
      }
    },
    /** 头像选择（open-type=chooseAvatar；e.detail.avatarUrl 是本地临时文件路径） */
    onChooseAvatar(e) {
      const url = e.detail && e.detail.avatarUrl
      if (!url) {
        // 隐私弹层里点了「拒绝」时微信直接拦下，errMsg 会带 privacy
        const errMsg = (e.detail && e.detail.errMsg) || ''
        if (errMsg.indexOf('scope is not declared') >= 0) {
          toast('头像选择暂不可用，请稍后再试')
          return
        }
        if (errMsg.indexOf('privacy') >= 0) {
          toast('需先同意《小程序隐私保护指引》才能设置头像')
        }
        return
      }
      this.setData({
        tempAvatar: url,
        canSave: true,
      })
      if (!this.data.privacyAgreed)
        this.setData({
          privacyAgreed: true,
          privacyReady: true,
        })
    },
    /** 历史头像失效时回落文字块；新选的临时图失败时也允许重新选择。 */
    onAvatarImageError() {
      if (this.data.tempAvatar) {
        const nick = (this.data.nickInput || '').trim()
        this.setData({
          tempAvatar: '',
          canSave:
            (!!nick && nick !== this.data.name) ||
            (this.data.phoneRequired && !!this.data.phoneDisplay),
        })
        return
      }
      this.setData({
        avatarSrc: '',
      })
    },
    onNickInput(e) {
      const nickInput = e.detail.value
      const nick = (nickInput || '').trim()
      const nickChanged = !!nick && nick !== this.data.name
      this.setData({
        nickInput,
        hasNickname: !!nick && nick !== DEFAULT_NAME,
        canSave:
          nickChanged ||
          !!this.data.tempAvatar ||
          (this.data.phoneRequired && !!this.data.phoneDisplay),
      })
    },
    async save() {
      if (this.data.saving) return
      const nick = (this.data.nickInput || '').trim()
      const nickChanged = !!nick && nick !== this.data.name
      const avatarChanged = !!this.data.tempAvatar
      if (this.data.nameRequired && (!nick || nick === DEFAULT_NAME)) {
        toast('请填写昵称，完成注册')
        return
      }
      if (this.data.phoneRequired && !this.data.phoneDisplay) {
        toast('请先验证手机号，完成注册')
        return
      }
      const phoneCompleted =
        this.data.phoneRequired && this.data.phoneDisplay && this.data.canSave
      if (!nickChanged && !avatarChanged && !phoneCompleted) {
        toast('没有需要保存的修改')
        return
      }
      this.setData({
        saving: true,
      })
      let avatarPath = this.data.avatarPath
      try {
        if (avatarChanged) {
          const r = await api.uploadAvatar(this.data.tempAvatar)
          avatarPath = r.avatarPath
        }
        if (nickChanged) {
          await api.updateNickname(nick)
        }
        Taro.showToast({
          title: '已保存',
          icon: 'success',
        })
        this.triggerEvent('saved', {
          avatarPath,
          name: nickChanged ? nick : this.data.name,
          phoneText: this.data.phoneDisplay,
        })
      } catch (e) {
        toast(e.message)
      } finally {
        this.setData({
          saving: false,
        })
      }
    },
    close() {
      this.triggerEvent('close')
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      title,
      phoneRequired,
      nameRequired,
      subtitle,
      tempAvatar,
      avatarSrc,
      avatarChar,
      nickInput,
      phoneDisplay,
      phoneScopeError,
      privacyReady,
      privacyAgreed,
      phoneBinding,
      canSave,
      hasNickname,
      saving,
      submitLabel,
    } = this.data
    return (
      <UiSheet
        title={title}
        variant="profile"
        closable={!phoneRequired && !nameRequired}
        onClose={this.close}
      >
        {subtitle && (
          <View className="pe-sub">
            <Text>{subtitle}</Text>
          </View>
        )}
        {/*
            常规注册表：一组「左标签 + 右值」的行，细线分隔，头像 → 昵称 → 手机号。
            说明文字一律不进行内，统一收到列表下方的 .pe-note——
            每行各挂一句说明是上一版最主要的杂乱来源。
           */}
        <View className="pe-form">
          <Button
            className="pe-row pe-row--btn"
            openType="chooseAvatar"
            onChooseAvatar={this.onChooseAvatar}
            hoverClass="pe-row--pressed"
            ariaLabel="设置头像"
          >
            <Text className="pe-label">头像</Text>
            <View className="pe-value">
              <Text className="pe-opt">选填</Text>
              {tempAvatar || avatarSrc ? (
                <Image
                  className="pe-avatar"
                  src={tempAvatar || avatarSrc}
                  mode="aspectFill"
                  onError={this.onAvatarImageError}
                ></Image>
              ) : (
                <View className="pe-avatar pe-avatar--fallback">
                  {avatarChar}
                </View>
              )}
              <View className="pe-arrow"></View>
            </View>
          </Button>
          <View className="pe-row">
            <Text className="pe-label">昵称</Text>
            <View className="pe-value">
              {!nameRequired && <Text className="pe-opt">选填</Text>}
              <Input
                type="nickname"
                value={nickInput}
                placeholder="请输入昵称"
                placeholderStyle="color:#6E685F"
                className="pe-input"
                maxlength="30"
                onInput={this.onNickInput}
              ></Input>
            </View>
          </View>
          {/*  手机号：只在首次注册（phoneRequired）或已绑定时出现；我的页编辑不渲染  */}
          {(phoneRequired || phoneDisplay) && (
            <View className="pe-row">
              <Text className="pe-label">手机号</Text>
              <View className="pe-value">
                {phoneDisplay ? (
                  <Text className="pe-phone mono">{phoneDisplay}</Text>
                ) : phoneScopeError ? (
                  <Text className="pe-state">暂不可用</Text>
                ) : !privacyReady ? (
                  <Text className="pe-state">检查中…</Text>
                ) : !privacyAgreed ? (
                  <Button
                    id="profile-privacy-agree"
                    className="pe-inline-btn"
                    openType="agreePrivacyAuthorization"
                    onAgreeprivacyauthorization={this.onAgreePrivacy}
                  >
                    同意隐私指引
                  </Button>
                ) : (
                  <Button
                    className="pe-inline-btn pe-inline-btn--primary"
                    openType="getPhoneNumber"
                    loading={phoneBinding}
                    onGetphonenumber={this.onPhone}
                  >
                    微信绑定
                  </Button>
                )}
                {/*  后台未声明 scope：配置问题，再点也不会成功，按钮收掉、原因写在下方  */}
                {/*  未同意微信隐私协议：必须先走官方 agreePrivacyAuthorization，不能直接调 getPhoneNumber  */}
              </View>
            </View>
          )}
        </View>
        {/*  全部说明收在这里，一次只说当前这一步需要知道的事  */}
        {(phoneRequired || phoneDisplay) && (
          <View className="pe-note">
            {phoneScopeError ? (
              <Block>
                <Text className="pe-note-err">{phoneScopeError}</Text>
                <Text className="pe-link" onClick={this.openPrivacyContract}>
                  查看《小程序隐私保护指引》
                </Text>
              </Block>
            ) : !privacyAgreed && privacyReady ? (
              <Block>
                <Text>绑定手机号前，请先阅读并同意</Text>
                <Text className="pe-link" onClick={this.openPrivacyContract}>
                  《小程序隐私保护指引》
                </Text>
              </Block>
            ) : (
              <Text>
                手机号用于确认会员身份与必要的服务联系，不会获取通讯录，也不会公开展示。
              </Text>
            )}
          </View>
        )}
        {/*
            提交按钮常驻。
            上一版在手机号完成前整个按钮都不渲染，用户面对一张没有提交入口的表，
            既不知道还差什么，也不知道填完会发生什么。现在保持可见并置灰，
            按钮文案直接说明卡在哪一步。
           */}
        <Button
          className="btn btn--primary pe-save"
          disabled={
            !canSave ||
            (phoneRequired && !phoneDisplay) ||
            (nameRequired && !hasNickname)
          }
          loading={saving}
          onClick={this.save}
        >
          {submitLabel}
        </Button>
      </UiSheet>
    )
  }
}
export default _C
