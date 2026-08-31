package com.app.frostprotectionsystemandroid.data.source.datasource

import com.app.frostprotectionsystemandroid.data.model.Task
import io.reactivex.Observable
import io.reactivex.Single
import retrofit2.Response

/**
 *
 */
interface TaskDataSource {

    /**
     * This method use to get list task
     */
    fun getListTask(): Observable<List<Task>>

    /**
     * This method use to create new task
     *
     * @param task task
     */
    fun createTask(task: Task): Single<Task>

    /**
     * This method use to get task detail
     *
     * @param id id of task
     */
    fun getTaskDetail(id: Int): Single<Task>

    /**
     * This method use to edit task
     *
     * @param id id of task
     * @param task task
     */
    fun editTask(id: Int, task: Task): Single<Task>

    /**
     * This method use to delete task
     *
     * @param id id of task
     */
    fun deleteTask(id: Int): Single<Response<Unit>>
}
