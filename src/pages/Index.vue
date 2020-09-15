<template xmlns:v-slot="http://www.w3.org/1999/XSL/Transform">
  <q-page class="flex flex-center column">
    <div class="row text-white">
      请输入要下载的好看视频地址，多个请换行
    </div>
    <div class="row" style="width: 100%; padding: 10px">
      <q-input standout square v-model="url" :dense=true bg-color="orange" type="textarea" v-show="!loading"
               style="width: 100%"></q-input>
      <q-list dark bordered style="width: 100%" v-show="loading">
        <q-item v-ripple v-for="video in videoList" :key="'label' + video.url" style="width: 100%">
          <div class="flex flex-center column" style="width: 100%">
            <div class="row" style="width: 100%">
              <q-item-section>{{video.url}}</q-item-section>
            </div>
            <div class="row" style="width: 100%">
              <q-linear-progress dark stripe rounded size="20px" :value="video.percentage / 100" :color=video.color class="q-mt-sm" >
                <div class="absolute-full flex flex-center">
                  <q-badge color="white" text-color="accent" :label="video.percentage + '%'" />
                </div>
              </q-linear-progress>
            </div>
          </div>
        </q-item>
      </q-list>
    </div>
    <div class="row">
      <q-btn style="background: #FF0080; color: white; width: 200px"
             :loading="loading"
             @click="download"
             :percentage="totalPercentage" label="点击下载" v-show="!downloadComplete">
        <template v-slot:loading>
          <q-spinner-gears class="on-left" />
          下载总进度({{totalPercentage}}%)...
        </template>
      </q-btn>
      <q-btn color="primary"
             @click="continueDownload"
             label="继续下载其它视频" v-show="downloadComplete">
      </q-btn>
    </div>
    <q-dialog v-model="alert" persistent transition-show="flip-down" transition-hide="flip-up">
      <q-card :class="alertClass" class="bg-primary">
        <q-card-section>
          <div class="text-h6">{{messageType}}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          {{message}}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { ipcRenderer } from 'electron'

export default {
  name: 'PageIndex',
  data () {
    return {
      url: '',
      loading: false,
      totalPercentage: 0,
      alert: false,
      alertClass: '',
      messageType: '错误',
      message: '',
      videoList: [],
      downloadComplete: false
    }
  },
  methods: {
    continueDownload () {
      this.loading = false
      this.downloadComplete = false
      this.url = ''
      this.videoList = []
      this.totalPercentage = 0
    },
    download () {
      if (this.loading) {
        return
      }
      const url = this.delSpaces(this.url)
      if (!url) {
        return this.showAlert({ message: '下载地址不能为空' })
      }
      const videoList = url.split('\n').map(url => ({ url, percentage: 0, color: 'warning' }))
      const invalidVideoIndex = videoList.findIndex(video => !video.url.startsWith('https://haokan.baidu.com/v?'))
      if (invalidVideoIndex > -1) {
        return this.showAlert({ message: `第${invalidVideoIndex + 1}条地址不合法` })
      }
      this.videoList = videoList
      this.loading = true
      this.totalPercentage = 0
      this.url = url
      this.downloadOneVideo({})
    },

    downloadOneVideo ({ index = 0 }) {
      if (index > this.videoList.length - 1) {
        return
      }
      const video = this.videoList[index]
      ipcRenderer.send('downloadFile', { url: video.url, index })
    },

    showAlert ({ message, messageType = '错误', alertClass = 'bg-white text-pink' }) {
      this.message = message
      this.messageType = messageType
      this.alert = true
      this.alertClass = alertClass
    },
    delSpaces (s) {
      return s && s.replace('\\r', '').replace('\\n', '').replace('\t', '').trim()
    },
    calcTotalPercentage (index) {
      this.totalPercentage = Math.round((index * 100 + this.videoList[index].percentage) / this.videoList.length)
    }
  },
  async mounted () {
    ipcRenderer.on('downloading', (event, { index, percentage }) => {
      this.videoList[index].percentage = percentage
      this.calcTotalPercentage(index)
    })
    ipcRenderer.on('downloadComplete', (event, { fileFolder, index }) => {
      this.videoList[index].percentage = 100
      this.videoList[index].color = 'success'
      this.calcTotalPercentage(index)
      this.downloadOneVideo({ index: index + 1 })
      if (index >= this.videoList.length - 1) {
        this.downloadComplete = true
        this.showAlert({ message: `所有文件下载到:${fileFolder}`, messageType: '成功', alertClass: 'bg-white text-green' })
      }
    })
    ipcRenderer.on('downloadFail', (event, { error, index }) => {
      this.videoList[index].percentage = 100
      this.videoList[index].color = 'red'
      this.calcTotalPercentage(index)
      this.downloadOneVideo({ index: index + 1 })
      console.log(error)
      this.showAlert({ message: `第${index + 1}条下载失败:${JSON.stringify(error)}` })
      if (index >= this.videoList.length - 1) {
        this.downloadComplete = true
      }
    })
  }
}
</script>
